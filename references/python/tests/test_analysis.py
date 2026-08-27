"""Software checks and mathematical invariants, not clinical validation."""
import ast
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from backend.analysis import (AnalysisError, LANDMARK_INDEX, analyze_landmarks, calculate_angle_2d,
    detect_strokes, extract_frame_features, find_finish_between_catches, preprocess,
    resample_signal, standardize_one_stroke, trunk_lean_from_vertical)
from backend.contracts import AnalysisConfig, FEATURES, VideoInfo
from backend.scoring import compare, root_mean_squared_error


@pytest.fixture(scope="module")
def notebook_functions():
    """Execute only reviewed function definitions from the preserved original notebook."""
    path = next((Path(__file__).resolve().parents[3] / "source").glob("*.ipynb"))
    notebook = json.loads(path.read_text(encoding="utf-8"))
    namespace = {"np": np, "LANDMARK_INDEX": LANDMARK_INDEX,
                 "SMOOTH_COLUMNS": [f"{name}_smooth" for name in FEATURES]}
    wanted = {"calculate_angle_2d", "trunk_lean_from_vertical", "extract_frame_features",
              "resample_signal", "standardize_one_stroke", "find_finish_between_catches"}
    for cell in notebook["cells"]:
        source = "".join(cell["source"])
        if cell["cell_type"] != "code" or source.startswith("!"):
            continue
        for node in ast.parse(source).body:
            if isinstance(node, ast.FunctionDef) and node.name in wanted:
                exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), namespace)
    assert wanted.issubset(namespace)
    return namespace


def test_angle_geometric_invariants():
    assert calculate_angle_2d([1, 0], [0, 0], [0, 1]) == pytest.approx(90)
    assert calculate_angle_2d([-1, 0], [0, 0], [1, 0]) == pytest.approx(180)
    assert np.isnan(calculate_angle_2d([0, 0], [0, 0], [1, 0]))
    assert calculate_angle_2d([1, 0], [0, 0], [1, 1]) == pytest.approx(45)


def test_angle_and_trunk_parity(notebook_functions):
    rng = np.random.default_rng(17)
    for _ in range(100):
        a, b, c = rng.uniform(-2, 2, (3, 2))
        assert calculate_angle_2d(a, b, c) == pytest.approx(notebook_functions["calculate_angle_2d"](a, b, c), abs=1e-10)
        assert trunk_lean_from_vertical(a, b) == pytest.approx(notebook_functions["trunk_lean_from_vertical"](a, b), abs=1e-10)


def test_frame_feature_parity(notebook_functions):
    rng = np.random.default_rng(19)
    landmarks = [{"x": float(x), "y": float(y), "visibility": .9} for x, y in rng.random((33, 2))]
    for side in ("left", "right"):
        original = notebook_functions["extract_frame_features"](10, landmarks, 30, side)
        current = extract_frame_features(10, landmarks, 30, side)
        for key in original:
            assert current[key] == pytest.approx(original[key], abs=1e-10)


def test_aspect_ratio_correction():
    # A 90-degree angle in pixel space should stay 90 after normalization is undone.
    points = np.array([[200., 0.], [100., 100.], [200., 200.]])
    normalized = points / [400, 200]
    assert calculate_angle_2d(*points) == pytest.approx(90)
    assert calculate_angle_2d(*(normalized * [400, 200])) == pytest.approx(90)
    assert abs(calculate_angle_2d(*normalized) - 90) > 1


def test_mirror_preserves_joint_angles_and_reverses_trunk():
    rng = np.random.default_rng(3)
    landmarks = [{"x": float(x), "y": float(y), "visibility": .9} for x, y in rng.random((33, 2))]
    normal = extract_frame_features(0, landmarks, 30, "left", width=568, height=320)
    mirrored = extract_frame_features(0, landmarks, 30, "left", width=568, height=320, mirror=True)
    for name in FEATURES[:3]:
        assert mirrored[name] == pytest.approx(normal[name])
    assert mirrored["trunk_lean"] == pytest.approx(-normal["trunk_lean"])


@pytest.mark.parametrize("count", [2, 7, 40, 61])
def test_resampling_parity(notebook_functions, count):
    values = [50, 90, 150, 70]
    np.testing.assert_allclose(resample_signal(values, count), notebook_functions["resample_signal"](values, count), atol=1e-10, rtol=0)


def test_standardization_parity_and_finish(notebook_functions):
    rng = np.random.default_rng(3)
    table = pd.DataFrame(rng.random((120, 4)), columns=[f"{name}_smooth" for name in FEATURES])
    current = standardize_one_stroke(table, 4, 42, 115)
    original = notebook_functions["standardize_one_stroke"](table, 4, 42, 115)
    np.testing.assert_allclose(current, original, atol=1e-10, rtol=0)
    assert current.shape == (100, 4)
    np.testing.assert_allclose(current[39], table.iloc[42])
    np.testing.assert_allclose(current[-1], table.iloc[115])


def test_smoothing_and_missing_values():
    config = AnalysisConfig()
    raw = np.tile(np.arange(30.)[:, None], (1, 4))
    raw[6:16] = np.nan
    processed, smooth = preprocess(raw, config)
    assert np.isfinite(smooth).all()  # original pandas rule fills 10-frame interior gaps
    np.testing.assert_allclose(processed[:, 0], np.arange(30.))
    raw[5:17] = np.nan
    with pytest.raises(AnalysisError, match="gaps"):
        preprocess(raw, config)
    with pytest.raises(AnalysisError):
        preprocess(np.full((30, 4), np.nan), config)


def test_synthetic_catches_and_finish_parity(notebook_functions):
    time = np.arange(600) / 30
    knee = 110 + 50 * np.cos(2 * np.pi * time / 3)
    catches, strokes = detect_strokes(np.column_stack([knee] * 4), 30, AnalysisConfig())
    assert catches == [45, 135, 225, 315, 405, 495, 585]
    assert len(strokes) == 6
    np.testing.assert_array_equal(find_finish_between_catches(knee, catches), notebook_functions["find_finish_between_catches"](knee, catches))
    assert strokes[0].finish_frame == 90
    assert strokes[0].strokes_per_minute == pytest.approx(20)
    with pytest.raises(AnalysisError, match="No complete"):
        detect_strokes(np.ones((100, 4)), 30, AnalysisConfig())


def test_no_pose_rejected():
    info = VideoInfo(name="synthetic", width=100, height=100, fps=30, frame_count=3, duration_s=.1, sha256="test")
    with pytest.raises(AnalysisError, match="No person"):
        analyze_landmarks([None] * 3, info, AnalysisConfig())


def test_rmse_known_answer():
    assert root_mean_squared_error([10, 20], [10, 20]) == 0
    assert root_mean_squared_error([13, 24], [10, 20]) == pytest.approx(np.sqrt(12.5))


def synthetic_analysis(fingerprints, digest):
    from backend.contracts import VideoAnalysis
    values = np.asarray(fingerprints)
    return VideoAnalysis(video=VideoInfo(name="synthetic fixture", width=100, height=100,
        fps=30, frame_count=120, duration_s=4, sha256=digest), active_side="left",
        detection_coverage=1, measured_coverage=1, interpolated_frames=0,
        landmarks=[], signals=[], catches=[], strokes=[], fingerprints=values.tolist(),
        mean=values.mean(axis=0).tolist(), std=values.std(axis=0).tolist(), warnings=[])


def test_scoring_keeps_candidate_variation():
    reference = synthetic_analysis(np.zeros((2, 100, 4)), "reference")
    candidate = synthetic_analysis(np.stack([np.ones((100, 4)) * 10, np.ones((100, 4)) * -10]), "candidate")
    result = compare(reference, candidate, AnalysisConfig(), {"fixture": "synthetic"})
    assert result.overall_rmse_degrees == 10
    assert result.per_stroke_rmse_degrees == [10, 10]
    assert [item.rmse_degrees for item in result.features] == [10] * 4
    assert root_mean_squared_error(candidate.mean, reference.mean) == 0


def test_scoring_phase_boundaries_and_equal_weights():
    reference = synthetic_analysis(np.zeros((1, 100, 4)), "reference")
    values = np.zeros((1, 100, 4))
    values[:, :40, 0] = 10
    result = compare(reference, synthetic_analysis(values, "candidate"), AnalysisConfig(), {})
    assert result.features[0].drive_rmse_degrees == 10
    assert result.features[0].recovery_rmse_degrees == 0
    assert result.features[0].rmse_degrees == pytest.approx(np.sqrt(40))
    assert result.overall_rmse_degrees == pytest.approx(np.sqrt(10))
    assert "knee" in result.feedback[0] and "drive" in result.feedback[0]


def test_identical_file_is_labeled_self_check():
    reference = synthetic_analysis(np.zeros((1, 100, 4)), "identical")
    result = compare(reference, reference, AnalysisConfig(), {})
    assert result.overall_rmse_degrees == 0
    assert result.evidence_status.startswith("Self-comparison")
