"""Local-only HTTP adapter. Numerical logic lives in analysis.py and scoring.py."""
from functools import lru_cache
from importlib.metadata import version
import logging
import platform
from pathlib import Path
import tempfile
from threading import Lock
from typing import Literal

import cv2
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .acquisition import (CANDIDATE_PATH, KNOWN_FRONTAL_SHA256, MAX_BYTES, MODEL_PATH, MODEL_URL, REFERENCE_PATH,
                          ROOT, extract_video_landmarks, file_sha256, inspect_video)
from .analysis import AnalysisError, analyze_landmarks
from .contracts import AnalysisConfig, ComparisonReport
from .scoring import compare

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="SmartRow research API", version="0.1.0")
analysis_lock = Lock()
MEDIA = {"reference": REFERENCE_PATH, "candidate": CANDIDATE_PATH}


@app.get("/api/health")
def health():
    return {"status": "ready" if MODEL_PATH.exists() else "model_missing",
            "model_ready": MODEL_PATH.exists(), "reference_ready": REFERENCE_PATH.exists(),
            "candidate_ready": CANDIDATE_PATH.exists(), "busy": analysis_lock.locked(),
            "candidate_front_facing": CANDIDATE_PATH.exists() and file_sha256(CANDIDATE_PATH) == KNOWN_FRONTAL_SHA256}


@app.get("/api/media/{kind}")
def media(kind: Literal["reference", "candidate"]):
    path = MEDIA[kind]
    if not path.exists():
        raise HTTPException(404, "Supplied video not found.")
    return FileResponse(path, media_type="video/quicktime")


@app.get("/api/poster/{kind}")
def poster(kind: Literal["reference", "candidate"]):
    cap = cv2.VideoCapture(str(MEDIA[kind]))
    try:
        ok, frame = cap.read()
        if not ok:
            raise HTTPException(404, "Video preview unavailable.")
        ok, encoded = cv2.imencode(".jpg", frame)
        if not ok:
            raise HTTPException(422, "Could not create video preview.")
        return Response(encoded.tobytes(), media_type="image/jpeg")
    finally:
        cap.release()


@lru_cache(maxsize=2)
def reference_analysis(video_hash, model_hash, config_json):
    # Cache identity includes video content, model content and all analysis settings.
    config = AnalysisConfig.model_validate_json(config_json)
    landmarks, info = extract_video_landmarks(REFERENCE_PATH)
    return analyze_landmarks(landmarks, info, config)


def create_report(candidate_path, candidate_name, config):
    if not REFERENCE_PATH.exists():
        raise AnalysisError("The coach reference is missing from source/standard video/Video.mov.")
    if not MODEL_PATH.exists():
        raise AnalysisError("Pose model is missing. Run: python -m backend.setup_model")
    if file_sha256(candidate_path) == KNOWN_FRONTAL_SHA256:
        raise AnalysisError("The supplied Video_1.mov is front-facing. This side-view 2D method cannot validly compare it with the coach reference. Upload a fixed side-view recording instead.")
    inspect_video(candidate_path, candidate_name)
    model_hash = file_sha256(MODEL_PATH)
    reference = reference_analysis(file_sha256(REFERENCE_PATH), model_hash, config.model_dump_json())
    if file_sha256(candidate_path) == reference.video.sha256:
        # Explicit self-check: reuse identical measured landmarks, not synthetic output.
        history = [[point.model_dump() for point in frame] if frame else None for frame in reference.landmarks]
        info = reference.video.model_copy(update={"name": candidate_name})
    else:
        history, info = extract_video_landmarks(candidate_path, candidate_name)
    candidate = analyze_landmarks(history, info, config, mirror=config.mirror_candidate)
    provenance = {name: version(name) for name in ["numpy", "scipy", "pandas", "mediapipe"]}
    provenance.update({"model_url": MODEL_URL, "model_sha256": model_hash,
                       "python": platform.python_version(), "opencv": cv2.__version__,
                       "notebook": "source/Hagan_Lecture_5_Motion_and_Standardized_Stroke (1).ipynb",
                       "notebook_sha256": file_sha256(ROOT / "source" / "Hagan_Lecture_5_Motion_and_Standardized_Stroke (1).ipynb")})
    return compare(reference, candidate, config, provenance)


@app.post("/api/compare", response_model=ComparisonReport)
def compare_videos(candidate: UploadFile | None = File(default=None),
                   use_sample: bool = Form(default=False),
                   side_view_confirmed: bool = Form(default=False),
                   coordinate_mode: Literal["pixel", "notebook"] = Form(default="pixel"),
                   mirror_candidate: bool = Form(default=False)):
    if not analysis_lock.acquire(blocking=False):
        raise HTTPException(409, "An analysis is already running. Please wait before starting another.")
    try:
        if use_sample == (candidate is not None):
            raise HTTPException(422, "Choose either one uploaded video or the supplied candidate.")
        config = AnalysisConfig(coordinate_mode=coordinate_mode, mirror_candidate=mirror_candidate)
        if use_sample:
            if CANDIDATE_PATH.exists() and file_sha256(CANDIDATE_PATH) == KNOWN_FRONTAL_SHA256:
                raise AnalysisError("The supplied Video_1.mov is front-facing. This side-view 2D method cannot validly compare it with the coach reference. Upload a fixed side-view recording instead.")
            if not side_view_confirmed:
                raise HTTPException(422, "Confirm that the candidate shows one rower in a fixed full-body side view.")
            return create_report(CANDIDATE_PATH, CANDIDATE_PATH.name, config)
        if not side_view_confirmed:
            raise HTTPException(422, "Confirm that the uploaded video shows one rower in a fixed full-body side view.")
        suffix = Path(candidate.filename or "").suffix.lower()
        if suffix not in {".mp4", ".mov", ".webm", ".m4v"}:
            raise HTTPException(415, "Choose an MP4, MOV, M4V or WebM video.")
        # Filenames never become filesystem paths. The temporary copy is always removed.
        with tempfile.TemporaryDirectory(prefix="smartrow-") as directory:
            path = Path(directory) / f"candidate{suffix}"
            size = 0
            with path.open("wb") as handle:
                while chunk := candidate.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "Demo upload limit is 100 MiB. Please trim the video.")
                    handle.write(chunk)
            if not size:
                raise HTTPException(422, "The selected file is empty.")
            return create_report(path, Path(candidate.filename).name, config)
    except AnalysisError as error:
        raise HTTPException(422, str(error)) from error
    except HTTPException:
        raise
    except Exception as error:
        logging.exception("Analysis failed")
        raise HTTPException(500, "Analysis failed. Check the local Python terminal for details; no score was produced.") from error
    finally:
        if candidate is not None:
            candidate.file.close()
        analysis_lock.release()


# One-process local demonstration after `npm run build`; not a public upload service.
if (ROOT / "dist").exists():
    app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="frontend")
