"""Descriptive distances, not technique grades or medical predictions."""
from datetime import datetime, timezone
import numpy as np

from .contracts import AnalysisConfig, ComparisonReport, FEATURES, LABELS, FeatureComparison, VideoAnalysis

LIMITATIONS = [
    "RMSE measures similarity to this reference, not correctness, safety, or injury risk.",
    "This is a cross-video extension of a within-video notebook demonstration; coach validation is still TODO.",
    "One rower, fixed side view, visible whole body, comparable camera placement and facing direction are required; these conditions are not automatically verified.",
    "Camera perspective, body proportions, occlusion and pose-estimation error can change the measurements.",
    "Frame timing assumes constant FPS. Variable-frame-rate video needs conversion or a future timestamp-aware decoder.",
    "Stroke detection uses experimental notebook settings: 2 s minimum spacing, 15° prominence and sigma 2 frames; these are not universal rowing thresholds.",
    "The 40/60 phase resampling removes timing differences from the angle comparison; inspect stroke timing separately.",
    "Neck and wrist analysis, a calibrated 0–100 score, and injury-related advice are not implemented or validated.",
]


def root_mean_squared_error(values, reference, axis=None):
    return np.sqrt(np.mean((np.asarray(values) - np.asarray(reference)) ** 2, axis=axis))


def compare(reference: VideoAnalysis, candidate: VideoAnalysis, config: AnalysisConfig, provenance):
    strokes = np.asarray(candidate.fingerprints)
    reference_mean = np.asarray(reference.mean)
    squared_errors = (strokes - reference_mean) ** 2
    feature_rmse = np.sqrt(squared_errors.mean(axis=(0, 1)))
    boundary = config.drive_points
    features = [FeatureComparison(feature=name, label=LABELS[i], rmse_degrees=float(feature_rmse[i]),
                drive_rmse_degrees=float(np.sqrt(squared_errors[:, :boundary, i].mean())),
                recovery_rmse_degrees=float(np.sqrt(squared_errors[:, boundary:, i].mean())))
                for i, name in enumerate(FEATURES)]
    largest = max(features, key=lambda item: item.rmse_degrees)
    phase = "drive" if largest.drive_rmse_degrees >= largest.recovery_rmse_degrees else "recovery"
    feedback = [
        f"Review {largest.label.lower()} motion first: it has the largest measured difference ({largest.rmse_degrees:.1f}° RMSE), with more difference during {phase}. This is a review priority, not an identified fault.",
        "Replay the selected stroke and check the tracked landmarks before interpreting the angle curves.",
        "Discuss visible differences with your coach. A single reference cannot establish an ideal or safe movement pattern.",
    ]
    self_comparison = reference.video.sha256 == candidate.video.sha256
    if self_comparison:
        feedback.insert(0, "Self-comparison check: the candidate and reference are the same file. Nonzero RMSE describes within-reference stroke variation, not independent athlete performance.")
    return ComparisonReport(created_at=datetime.now(timezone.utc).isoformat(), provenance=provenance,
        config=config, reference=reference, candidate=candidate, features=features,
        overall_rmse_degrees=float(np.sqrt(squared_errors.mean())),
        per_stroke_rmse_degrees=np.sqrt(squared_errors.mean(axis=(1, 2))).tolist(),
        feedback=feedback, limitations=LIMITATIONS,
        evidence_status="Self-comparison software check; not independent evaluation." if self_comparison else "Measured video-derived estimates; not scientifically validated ratings.")
