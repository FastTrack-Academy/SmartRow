"""Pure numerical stages derived from lecture 5. No HTTP or UI logic here."""
import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

from .contracts import AnalysisConfig, FEATURES, SignalFrame, Stroke, VideoAnalysis, VideoInfo

LANDMARK_INDEX = {
    "left": {"shoulder": 11, "elbow": 13, "wrist": 15, "hip": 23, "knee": 25, "ankle": 27},
    "right": {"shoulder": 12, "elbow": 14, "wrist": 16, "hip": 24, "knee": 26, "ankle": 28},
}


class AnalysisError(ValueError):
    """An input cannot support the specified analysis; do not produce a score."""


def calculate_angle_2d(a, b, c):
    # Notebook cell 20, retained numerically (including degenerate-vector guard).
    a, b, c = (np.asarray(point, dtype=float) for point in (a, b, c))
    vector_ba, vector_bc = a - b, c - b
    denominator = np.linalg.norm(vector_ba) * np.linalg.norm(vector_bc)
    if denominator < 1e-8:
        return np.nan
    cosine = np.clip(np.dot(vector_ba, vector_bc) / denominator, -1.0, 1.0)
    return float(np.degrees(np.arccos(cosine)))


def trunk_lean_from_vertical(shoulder_xy, hip_xy):
    dx, dy = np.asarray(shoulder_xy) - np.asarray(hip_xy)
    return float(np.degrees(np.arctan2(dx, -dy)))


def mean_side_visibility(history, side):
    values = [frame[i]["visibility"] for frame in history if frame is not None
              for i in LANDMARK_INDEX[side].values()]
    return float(np.mean(values)) if values else 0.0


def extract_frame_features(frame_id, landmarks, fps, side, min_visibility=0.35,
                           width=1, height=1, mirror=False):
    """Unit width/height exactly preserves the notebook coordinate convention."""
    result = {"frame": frame_id, "time_s": frame_id / fps, "pose_quality": 0.0,
              **{name: np.nan for name in FEATURES}}
    if landmarks is None:
        return result
    ids = LANDMARK_INDEX[side]
    quality = float(np.mean([landmarks[i]["visibility"] for i in ids.values()]))
    result["pose_quality"] = quality
    if quality < min_visibility:
        return result
    # x and y have different normalizers. Pixels restore equal physical image units.
    sign = -1 if mirror else 1
    points = {name: np.array([sign * landmarks[i]["x"] * width, landmarks[i]["y"] * height])
              for name, i in ids.items()}
    for name, joints in [("knee_angle", ("hip", "knee", "ankle")),
                         ("hip_angle", ("shoulder", "hip", "knee")),
                         ("elbow_angle", ("shoulder", "elbow", "wrist"))]:
        result[name] = calculate_angle_2d(*(points[joint] for joint in joints))
    result["trunk_lean"] = trunk_lean_from_vertical(points["shoulder"], points["hip"])
    return result


def preprocess(raw, config):
    """Keep pandas' original bidirectional five-value limit (not a five-frame gap cap)."""
    processed = pd.DataFrame(raw).interpolate(
        limit=config.interpolation_limit, limit_direction="both").to_numpy()
    if not np.isfinite(processed).all():
        raise AnalysisError("Long or unusable pose gaps remain. Use a clear, full-body side-view clip; no score was produced.")
    return processed, gaussian_filter1d(processed, sigma=config.smoothing_sigma, axis=0)


def find_finish_between_catches(knee_signal, catch_frames):
    return np.asarray([start + int(np.argmax(knee_signal[start:end + 1]))
                       for start, end in zip(catch_frames[:-1], catch_frames[1:])], dtype=int)


def detect_strokes(smooth, fps, config):
    catches, _ = find_peaks(-smooth[:, 0],
                            distance=max(1, int(config.min_stroke_seconds * fps)),
                            prominence=config.catch_prominence)
    finishes = find_finish_between_catches(smooth[:, 0], catches)
    strokes = []
    for start, finish, end in zip(catches[:-1], finishes, catches[1:]):
        if not start < finish < end:
            continue
        duration = (end - start) / fps
        strokes.append(Stroke(id=len(strokes) + 1, catch_frame=int(start), finish_frame=int(finish),
                              next_catch_frame=int(end), cycle_seconds=duration,
                              drive_seconds=(finish - start) / fps,
                              recovery_seconds=(end - finish) / fps, strokes_per_minute=60 / duration))
    if not strokes:
        raise AnalysisError("No complete catch–finish–catch stroke was detected with the notebook parameters. Use a longer steady side-view clip; no score was produced.")
    return catches.tolist(), strokes


def resample_signal(values, target_points):
    values = np.asarray(values, dtype=float)
    if len(values) < 2:
        raise ValueError("At least two observations are required.")
    return np.interp(np.linspace(0, 1, target_points), np.linspace(0, 1, len(values)), values)


def standardize_one_stroke(motion_df, start_frame, finish_frame, end_frame,
                           drive_points=40, recovery_points=60):
    # Same public shape as cell 37, so parity tests can execute original code.
    columns = [f"{name}_smooth" for name in FEATURES]
    standardized = []
    for column in columns:
        drive = motion_df.loc[start_frame:finish_frame, column].to_numpy()
        recovery = motion_df.loc[finish_frame:end_frame, column].to_numpy()
        standardized.append(np.concatenate([resample_signal(drive, drive_points),
                                             resample_signal(recovery, recovery_points + 1)[1:]]))
    return np.column_stack(standardized)


def analyze_landmarks(history, video: VideoInfo, config: AnalysisConfig, mirror=False):
    if not history or not any(frame is not None for frame in history):
        raise AnalysisError("No person was detected. Use a well-lit video with one visible rower.")
    side = "left" if mean_side_visibility(history, "left") >= mean_side_visibility(history, "right") else "right"
    width, height = (video.width, video.height) if config.coordinate_mode == "pixel" else (1, 1)
    rows = [extract_frame_features(i, frame, video.fps, side, config.min_visibility, width, height, mirror)
            for i, frame in enumerate(history)]
    raw = np.array([[row[name] for name in FEATURES] for row in rows])
    processed, smooth = preprocess(raw, config)
    catches, strokes = detect_strokes(smooth, video.fps, config)
    frame_table = pd.DataFrame(smooth, columns=[f"{name}_smooth" for name in FEATURES])
    fingerprints = np.stack([standardize_one_stroke(frame_table, stroke.catch_frame, stroke.finish_frame,
                                                   stroke.next_catch_frame, config.drive_points, config.recovery_points)
                             for stroke in strokes])
    interpolated = int(np.isnan(raw).any(axis=1).sum())
    warnings = []
    if interpolated:
        warnings.append(f"{interpolated} frames contain interpolated angle measurements, not direct observations.")
    if len(strokes) < 3:
        warnings.append("Fewer than three complete strokes: this profile has very limited repeatability evidence.")
    if config.coordinate_mode == "notebook":
        warnings.append("Notebook mode uses normalized x/y and can distort angles in non-square video. Do not interpret these values as calibrated image-plane angles.")
    signals = [SignalFrame(frame=i, time_s=row["time_s"], quality=row["pose_quality"],
                           raw=[float(v) if np.isfinite(v) else None for v in raw[i]],
                           processed=processed[i].tolist(), smooth=smooth[i].tolist()) for i, row in enumerate(rows)]
    return VideoAnalysis(video=video, active_side=side,
                         detection_coverage=sum(frame is not None for frame in history) / len(history),
                         measured_coverage=1 - interpolated / len(history), interpolated_frames=interpolated,
                         landmarks=history, signals=signals, catches=catches, strokes=strokes,
                         fingerprints=fingerprints.tolist(), mean=fingerprints.mean(axis=0).tolist(),
                         std=fingerprints.std(axis=0).tolist(), warnings=warnings)
