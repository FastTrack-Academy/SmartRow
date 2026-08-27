from pathlib import Path

from fastapi.testclient import TestClient

import backend.main as main
from backend.acquisition import inspect_video
from backend.analysis import AnalysisError

client = TestClient(main.app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert isinstance(response.json()["model_ready"], bool)


def test_requires_exactly_one_candidate():
    assert client.post("/api/compare").status_code == 422
    assert client.post("/api/compare", data={"use_sample": "true"}, files={"candidate": ("clip.mp4", b"x")}).status_code == 422


def test_rejects_invalid_format_empty_file_and_mode():
    assert client.post("/api/compare", data={"side_view_confirmed": "true"}, files={"candidate": ("bad.txt", b"hello")}).status_code == 415
    assert client.post("/api/compare", files={"candidate": ("bad.mp4", b"")}).status_code == 422
    assert client.post("/api/compare", data={"coordinate_mode": "unknown"}).status_code == 422


def test_oversized_upload_limit(monkeypatch):
    monkeypatch.setattr(main, "MAX_BYTES", 10)
    response = client.post("/api/compare", data={"side_view_confirmed": "true"}, files={"candidate": ("clip.mp4", b"x" * 20)})
    assert response.status_code == 413


def test_busy_returns_conflict():
    main.analysis_lock.acquire()
    try:
        assert client.post("/api/compare", data={"use_sample": "true"}).status_code == 409
    finally:
        main.analysis_lock.release()


def test_upload_deleted_on_analysis_error(monkeypatch):
    observed = []
    def fail(path, name, config):
        observed.append(Path(path))
        assert Path(path).exists()
        raise AnalysisError("Expected synthetic failure")
    monkeypatch.setattr(main, "create_report", fail)
    response = client.post("/api/compare", data={"side_view_confirmed": "true"}, files={"candidate": ("clip.mp4", b"test")})
    assert response.status_code == 422
    assert not observed[0].exists()
    assert not main.analysis_lock.locked()


def test_corrupt_video_rejected(tmp_path):
    path = tmp_path / "corrupt.mp4"
    path.write_bytes(b"not a video")
    try:
        inspect_video(path)
    except AnalysisError:
        pass
    else:
        raise AssertionError("Corrupt file must not yield measurements")


def test_media_is_allowlisted():
    assert client.get("/api/media/reference").status_code == 200
    assert client.get("/api/media/secret").status_code == 422
    assert client.get("/api/poster/candidate").headers["content-type"] == "image/jpeg"


def test_front_view_sample_is_not_scored():
    response = client.post("/api/compare", data={"use_sample": "true"})
    assert response.status_code == 422
    assert "front-facing" in response.json()["detail"]


def test_requires_capture_confirmation():
    response = client.post("/api/compare", files={"candidate": ("clip.mp4", b"test")})
    assert response.status_code == 422
    assert "Confirm" in response.json()["detail"]


def test_uploaded_copy_of_known_front_video_is_rejected():
    with main.CANDIDATE_PATH.open("rb") as handle:
        response = client.post("/api/compare", data={"side_view_confirmed": "true"}, files={"candidate": ("renamed.mov", handle)})
    assert response.status_code == 422
    assert "front-facing" in response.json()["detail"]
