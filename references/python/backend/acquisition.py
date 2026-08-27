"""Decode local videos and run the same MediaPipe Heavy model as the notebook."""
import hashlib
import logging
from pathlib import Path

import cv2
import numpy as np

from .analysis import AnalysisError
from .contracts import VideoInfo

ROOT = Path(__file__).resolve().parents[3]
MODEL_PATH = Path(__file__).resolve().parent / "models" / "pose_landmarker_heavy.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
MODEL_SHA256 = "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b"
REFERENCE_PATH = ROOT / "source" / "standard video" / "Video.mov"
CANDIDATE_PATH = ROOT / "source" / "candidate video" / "Video_1.mov"
KNOWN_FRONTAL_SHA256 = "6d37f5c3497028f0266ff50b9dc97b4e5315f7876b9a5cad1cf9e34922b99b46"
MAX_BYTES = 100 * 1024 * 1024
MAX_SECONDS = 120
MAX_FRAMES = 3600
MAX_PIXELS = 3840 * 2160
logger = logging.getLogger("smartrow")


def file_sha256(path):
    with open(path, "rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def inspect_video(path, name=None):
    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise AnalysisError("This file cannot be decoded as a video. Try an H.264 MP4 or a supported MOV.")
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if not np.isfinite(fps) or fps <= 0 or frames < 3 or width < 1 or height < 1:
            raise AnalysisError("Video metadata is missing or invalid; a reliable frame rate is required.")
        if frames / fps > MAX_SECONDS or frames > MAX_FRAMES or width * height > MAX_PIXELS:
            raise AnalysisError("Demo processing limit: at most 120 seconds, 3,600 frames and 4K resolution. Trim or resize this clip.")
        return VideoInfo(name=name or Path(path).name, width=width, height=height, fps=fps,
                         frame_count=frames, duration_s=frames / fps, sha256=file_sha256(path))
    finally:
        cap.release()


def extract_video_landmarks(path, name=None):
    if not MODEL_PATH.exists():
        raise AnalysisError("Pose model is missing. Run: python -m backend.setup_model")
    info = inspect_video(path, name)
    # Lazy import keeps health checks and numerical unit tests independent of model startup.
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=vision.RunningMode.VIDEO, num_poses=1,
        min_pose_detection_confidence=0.50, min_pose_presence_confidence=0.50,
        min_tracking_confidence=0.50)
    history = []
    cap = cv2.VideoCapture(str(path))
    try:
        with vision.PoseLandmarker.create_from_options(options) as detector:
            last_timestamp = -1
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                index = len(history)
                if index >= MAX_FRAMES or index / info.fps > MAX_SECONDS:
                    raise AnalysisError("Decoded video exceeds the demo processing limit.")
                if frame.shape[0] * frame.shape[1] > MAX_PIXELS:
                    raise AnalysisError("Decoded video exceeds 4K resolution.")
                if index == 0:
                    info.width, info.height = frame.shape[1], frame.shape[0]
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp = max(last_timestamp + 1, int(index / info.fps * 1000))
                result = detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp)
                last_timestamp = timestamp
                history.append([{key: float(getattr(lm, key)) for key in
                                 ("x", "y", "z", "visibility", "presence")}
                                for lm in result.pose_landmarks[0]] if result.pose_landmarks else None)
                if index % 50 == 0:
                    logger.info("%s: extracted %s/%s frames", info.name, index, info.frame_count)
    finally:
        cap.release()
    if len(history) != info.frame_count:
        raise AnalysisError("The decoded frame count differs from the video metadata. Re-encode the clip to constant-frame-rate H.264 before analysis.")
    return history, info
