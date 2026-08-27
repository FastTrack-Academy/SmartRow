"""Public data contracts; mirrored in src/contracts.ts. All angles are degrees."""
from typing import Literal

from pydantic import BaseModel

FEATURES = ["knee_angle", "hip_angle", "elbow_angle", "trunk_lean"]
LABELS = ["Knee", "Hip", "Elbow", "Trunk"]


class AnalysisConfig(BaseModel):
    coordinate_mode: Literal["pixel", "notebook"] = "pixel"
    mirror_candidate: bool = False
    smoothing_sigma: float = 2.0
    min_stroke_seconds: float = 2.0
    catch_prominence: float = 15.0
    min_visibility: float = 0.35
    interpolation_limit: int = 5
    drive_points: int = 40
    recovery_points: int = 60


class Landmark(BaseModel):
    x: float
    y: float
    z: float
    visibility: float
    presence: float


class VideoInfo(BaseModel):
    name: str
    width: int
    height: int
    fps: float
    frame_count: int
    duration_s: float
    sha256: str


class Stroke(BaseModel):
    id: int
    catch_frame: int
    finish_frame: int
    next_catch_frame: int
    cycle_seconds: float
    drive_seconds: float
    recovery_seconds: float
    strokes_per_minute: float


class SignalFrame(BaseModel):
    frame: int
    time_s: float
    quality: float
    raw: list[float | None]
    processed: list[float]
    smooth: list[float]


class VideoAnalysis(BaseModel):
    video: VideoInfo
    active_side: Literal["left", "right"]
    detection_coverage: float
    measured_coverage: float
    interpolated_frames: int
    landmarks: list[list[Landmark] | None]
    signals: list[SignalFrame]
    catches: list[int]
    strokes: list[Stroke]
    fingerprints: list[list[list[float]]]
    mean: list[list[float]]
    std: list[list[float]]
    warnings: list[str]


class FeatureComparison(BaseModel):
    feature: str
    label: str
    rmse_degrees: float
    drive_rmse_degrees: float
    recovery_rmse_degrees: float


class ComparisonReport(BaseModel):
    schema_version: str = "1.0"
    algorithm_version: str = "lecture5-cross-video-v1"
    created_at: str
    provenance: dict[str, str]
    config: AnalysisConfig
    reference: VideoAnalysis
    candidate: VideoAnalysis
    features: list[FeatureComparison]
    overall_rmse_degrees: float
    per_stroke_rmse_degrees: list[float]
    feedback: list[str]
    limitations: list[str]
    evidence_status: str = "Measured video-derived estimates; not scientifically validated ratings."
