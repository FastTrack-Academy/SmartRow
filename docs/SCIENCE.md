# Science and traceability

Primary source: `source/Hagan_Lecture_5_Motion_and_Standardized_Stroke (1).ipynb`. Cell numbers below are zero-based. Notebook execution outputs are historical demonstrations, not validation of this application.

Current deployment is browser-only. Python modules in the table below are the **preserved reference implementations** under references/python/backend. Production equivalents are src/analysis/{features,math,pipeline,scoring}.ts and pose.worker.ts. Their numerical parity fixtures are synthetic software checks, not athlete-level validation.

## Traceability

| Concept | Algorithm/source | Module | Output | Validation |
|---|---|---|---|---|
| Body pose | MediaPipe Heavy, VIDEO mode, confidence 0.5, one pose; cells 5,10–11 | acquisition.py | 33 points/frame | Overlay review; independently annotated landmarks TODO |
| Visible side | Highest mean six-joint visibility, tie left; cell 18 | analysis.py | selected side | Deterministic software checks; occlusion robustness TODO |
| 2D joint angles | Dot product/cosine at middle joint; cells 20,22 | analysis.py | knee, hip, elbow degrees | Original-function parity, 45/90/180° and degeneracy tests |
| Trunk lean | atan2(dx,−dy), image y downward; cell 22 | analysis.py | signed degrees from vertical | Original-function parity, mirroring test |
| Short missing sequences | pandas interpolate limit=5, both; cell 23 | analysis.py | processed signal, missing count | Finite/long-gap rejection tests |
| Denoising | scipy gaussian_filter1d sigma=2; cell 26 | analysis.py | smoothed angles | Same library; filtering/constant-signal tests; sensitivity study TODO |
| Catch/finish | negative knee peaks, distance=int(2*FPS), prominence=15; cells 29–30 | analysis.py | boundaries and timing | Synthetic known boundaries and original finish-function parity; human labels TODO |
| Phase normalization | 40 drive + recovery resampled to 61 then first removed; cells 35,37 | analysis.py | 100×4 fingerprint, finish index 39 | Original-function parity at absolute tolerance 1e-10; endpoint test |
| Reference profile | Mean and population SD (ddof=0) | analysis.py | mean±SD curves | Direct NumPy computation; reference suitability TODO |
| Distance | Feature-wise RMSE; cell 40, extended to all candidate strokes | scoring.py | differences in degrees | Known-distance and aggregation tests; coach agreement TODO |
| Feedback | Largest feature difference and phase RMSE | scoring.py | review priorities | Values sourced from same report; no inference about injury |

## Explicit changes from the lesson

1. **Cross-video comparison:** use every complete reference stroke, and compare every complete candidate stroke with the reference mean. The notebook holds out the last stroke of a single video. This application extension has not been scientifically validated.
2. **Aggregation:** for feature j, `sqrt(mean((candidate[s,p,j] - reference_mean[p,j])²))`, averaging over strokes s and standardized points p. Overall RMSE averages squared errors across all s,p,j; equal feature weighting is a declared prototype choice, not a validated coaching rubric. The chart can show a candidate mean, but the score never averages away candidate variation first.
3. **Pixel-corrected default:** MediaPipe x and y are normalized by separate frame dimensions. Use `(x*width, y*height)` so Euclidean image-plane geometry has equal units. Notebook mode uses unscaled `(x,y)` exactly. Correcting aspect ratio does not fix perspective or turn 2D estimates into anatomical ground truth. Cross-mode scores are not interchangeable.
4. **Facing correction:** user-selected horizontal reflection of candidate coordinates aligns trunk sign. The overlay stays in original video coordinates. Automatic camera orientation validation is not implemented.
5. **Suitability guard:** the supplied candidate is front-facing (visually inspected); refuse scoring it by sample selection or identical-content upload. Other files require capture confirmation, which is not an automated scientific check.
6. **Input failure guards:** invalid metadata, zero poses, unresolved gaps, no complete stroke and processing-limit violations return errors, not numeric scores.
7. **No minimum-three gate for descriptive output:** one complete cycle can produce a fingerprint, with a warning below three. The notebook's ≥3 check served its reference/held-out demonstration, not a statistically justified sample-size rule.

## Important subtleties

### Browser migration (schema 2.0)

- Acquisition now seeks at a fixed **30 Hz** (index/30 seconds) and waits for decoding before inference. Unlike the original OpenCV loop, this is not native-frame extraction. Encoded frames can repeat or be skipped, including for variable-frame-rate inputs. fps/frame_count/indices in v2 refer to this explicit sampling grid, with sampling_method recorded. Model timestamps are floor(index/30*1000) milliseconds.
- 30 Hz is an engineering choice close to the supplied videos' approximately 29.97 fps, not a scientifically validated optimal rate. Sigma 2 and interpolation limit 5 now apply to sampled frames. Cross-frame-rate sensitivity remains TODO.
- The Heavy model asset is unchanged, but browser decoder/color handling, the Web SDK and CPU runtime may change pose outputs. Float64 numerical parity on identical inputs does not imply identical inference results or measurements across Python, browsers or devices.
- TypeScript ports match the preserved NumPy/pandas/SciPy fixture calculations to absolute 1e-9, with exact catch/finish indices on supplied fixtures. Tests include edge/interior interpolation, reflected Gaussian boundaries, plateaus and prominence/distance ordering. SciPy does not guarantee ordering among equal-height conflicting peaks; TypeScript explicitly prefers later indices. Larger tied cases may differ and are not claimed universally equivalent.
- Web SDK exposes visibility but not presence; presence is null, never assigned a fictional confidence. Existing mean-visibility filtering is unchanged.
- No mock or synthetic fixture is used for displayed analysis. Browser self-comparison is actual model output but remains a software demonstration, not independent evaluation.
- On the exported 503-sample browser reference self-check, recomputing from the **same browser landmarks** through the preserved Python numerical functions gave identical catch indices and a maximum fingerprint difference of approximately 1.14e-13 degrees. This checks the language port only, not the pose model, sampling accuracy or athlete performance.

### Retained notebook subtleties

- `interpolate(limit=5, limit_direction='both')` can fill ten missing interior observations, not just gaps of five frames. Leading/trailing gaps up to five may be edge-filled. Preserve and disclose this behavior rather than claiming a stricter policy.
- Visibility threshold 0.35 is the **mean** over the six chosen joints. One poorly tracked joint can still pass. Per-joint reliability filtering is TODO.
- Smoothing sigma and interpolation limits are in frames, so their time scale changes with FPS. Detection uses the original int-truncated spacing. Fast rowing may be missed. Parameter sensitivity analysis is TODO.
- The notebook's cell 21 comment calls its fixture a right angle, but its coordinates and assertion correctly describe 45°. Tests include both 45° and 90°; original notebook remains unchanged.
- The reference band is population SD over observed strokes, not a confidence interval, safety band, normative range or measurement accuracy estimate.
- Self-comparison of every stroke against its own mean is generally nonzero; it measures internal variation and is not independent evaluation.
- The supplied candidate's front view cannot be repaired by changing image aspect ratio or simply flipping its x coordinates.

## Evidence status

No validated 0–100 mapping, injury thresholds, clinical outcome data, experimental accuracy, expert agreement, user-study results, confidence intervals or significance claims are available. None are fabricated. Neck/wrist definitions remain TODO as in the notebook. Phase timings are reported separately because normalized curve comparison discards duration differences.

## Validation plan (not completed results)

1. Obtain permission and independently annotate joint positions/angles and catches/finishes in appropriate side-view clips.
2. Predefine acceptable errors and report absolute-angle and boundary-timing error against annotations.
3. Test repeatability across recordings, viewpoints, body proportions, clothing, occlusion and stroke rates.
4. Run the notebook's sigma/minimum-seconds/prominence sensitivity experiment without selecting settings solely for a preferred answer.
5. Have coaches define a technique rubric, then evaluate agreement on held-out participants and recordings.
6. Treat any injury hypothesis as separate research requiring qualified supervision and appropriate study design; do not infer it from similarity alone.

## Technical references

- [MediaPipe Pose Landmarker Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js): browser VIDEO inference and synchronous calls/worker guidance.
- [MediaPipe Pose Landmarker Python guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/python): preserved reference runtime.
- [SciPy find_peaks](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html): distance/prominence behavior.

These technical documents are not evidence of rowing-technique validity or injury prediction.
