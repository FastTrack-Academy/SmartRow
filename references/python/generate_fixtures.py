"""Regenerate synthetic numerical parity fixtures. Not experimental rowing evidence.

Run from the project root with the optional preserved Python environment.
The web build/tests consume the committed JSON and never invoke Python.
"""
import json
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from backend.analysis import (calculate_angle_2d, trunk_lean_from_vertical,
    extract_frame_features, preprocess, detect_strokes, standardize_one_stroke)
from backend.contracts import AnalysisConfig, FEATURES
import pandas as pd

rng = np.random.default_rng(17)
config = AnalysisConfig()
angles = []
for _ in range(40):
    points = rng.uniform(-2, 2, (3, 2))
    angles.append({"points": points.tolist(), "angle": calculate_angle_2d(*points),
                   "trunk": trunk_lean_from_vertical(points[0], points[1])})

landmarks = [{"x": float(x), "y": float(y), "z": 0, "visibility": .9, "presence": .9}
             for x, y in rng.random((33, 2))]
features = []
for side in ("left", "right"):
    for width, height in [(1, 1), (568, 320)]:
        for mirror in (False, True):
            row = extract_frame_features(0, landmarks, 30, side, width=width, height=height, mirror=mirror)
            features.append({"side": side, "width": width, "height": height, "mirror": mirror,
                             "expected": [row[name] for name in FEATURES]})

filters = []
for size in [1, 2, 7, 40]:
    values = rng.normal(size=size)
    filters.append({"input": values.tolist(), "expected": gaussian_filter1d(values, sigma=2).tolist()})

interpolations = []
for start, count in [(0, 5), (0, 6), (9, 10), (9, 11), (25, 5), (24, 6), (0, 30)]:
    values = np.arange(30, dtype=float)
    values[start:start + count] = np.nan
    expected = pd.Series(values).interpolate(limit=5, limit_direction="both").to_numpy()
    clean = lambda sequence: [float(v) if np.isfinite(v) else None for v in sequence]
    interpolations.append({"input": clean(values), "expected": clean(expected)})

peaks = []
for _ in range(40):
    values = rng.normal(size=90)
    distance = int(rng.integers(1, 16))
    prominence = float(rng.uniform(0, 2))
    expected, _ = find_peaks(values, distance=distance, prominence=prominence)
    peaks.append({"input": values.tolist(), "distance": distance, "prominence": prominence, "expected": expected.tolist()})
for values in [[0, 2, 2, 2, 0, 1, 0], [0, 3, 0, 3, 0], [3, 3, 2, 0, 0]]:
    expected, _ = find_peaks(values, distance=3, prominence=1)
    peaks.append({"input": values, "distance": 3, "prominence": 1, "expected": expected.tolist()})

time = np.arange(600) / 30
raw = np.column_stack([110 + 50 * np.cos(2 * np.pi * time / 3),
                      90 + 30 * np.sin(2 * np.pi * time / 3),
                      100 + 40 * np.cos(2 * np.pi * time / 3 + .4),
                      15 * np.sin(2 * np.pi * time / 3 + .7)])
raw[100:108] = np.nan
processed, smooth = preprocess(raw, config)
catches, strokes = detect_strokes(smooth, 30, config)
table = pd.DataFrame(smooth, columns=[f"{name}_smooth" for name in FEATURES])
fingerprints = np.stack([standardize_one_stroke(table, s.catch_frame, s.finish_frame, s.next_catch_frame) for s in strokes])
reference_mean = fingerprints.mean(axis=0)
errors = (fingerprints - reference_mean) ** 2
fixture = {
    "description": "Synthetic software fixtures generated with the preserved Python implementation. Not athlete measurements.",
    "versions": {"numpy": np.__version__, "pandas": pd.__version__, "scipy": __import__('scipy').__version__},
    "angles": angles, "landmarks": landmarks, "features": features, "filters": filters,
    "interpolations": interpolations, "peaks": peaks,
    "pipeline": {"raw": [[float(v) if np.isfinite(v) else None for v in row] for row in raw],
        "processed": processed.tolist(), "smooth": smooth.tolist(), "catches": catches,
        "strokes": [s.model_dump() for s in strokes], "fingerprints": fingerprints.tolist(),
        "mean": reference_mean.tolist(), "std": fingerprints.std(axis=0).tolist(),
        "overall_rmse": float(np.sqrt(errors.mean())),
        "feature_rmse": np.sqrt(errors.mean(axis=(0, 1))).tolist(),
        "drive_rmse": np.sqrt(errors[:, :40].mean(axis=(0, 1))).tolist(),
        "recovery_rmse": np.sqrt(errors[:, 40:].mean(axis=(0, 1))).tolist()},
}
destination = Path(__file__).resolve().parents[2] / 'src/analysis/__fixtures__/python-parity.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(fixture, separators=(',', ':'), allow_nan=False), encoding='utf-8')
print(f'Wrote {destination.name}: synthetic fixtures only.')
