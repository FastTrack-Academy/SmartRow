# Architecture

## Deployment

**Netlify static hosting**, explicitly requested after the first local Python milestone. React 18 + TypeScript + Vite; Node 22 at build time. Publish only `dist/`. No backend, Python runtime, API proxy, Netlify Functions, database or cloud inference.

`scripts/prepare-assets.mjs` runs before dev/build. It copies unchanged source videos and the pinned MediaPipe Web runtime/WASM, verifies/downloads the Heavy model, compiles the typed worker and creates a source-hash manifest. Fresh builds need network for the model download. It uses Node and the existing TypeScript compiler, not Python.

## Responsibilities

| Layer | Module | Output |
|---|---|---|
| Static assets | scripts/prepare-assets.mjs | videos, model, WASM, worker, manifest |
| Acquisition | src/analysis/acquisition.ts | 30 Hz seek samples and metadata |
| Inference | pose.worker.ts, pose-client.ts | typed worker messages, landmarks/null |
| Features | features.ts | visible side and four raw angles |
| Numerical utilities | math.ts | angles, interpolation, Gaussian filter, peaks, resampling |
| Analysis | pipeline.ts | signals, strokes, fingerprints, mean/SD |
| Scoring/feedback | scoring.ts | RMSE and descriptive review notes |
| Orchestration | service.ts | reference/candidate → ComparisonReport |
| File/export helpers | src/files.ts | input checks and CSV/JSON downloads |
| Display | src/App.tsx, src/components | video/pose/curves/tables, progress/cancel |

Current contract: `src/contracts.ts`, schema **2.0**, algorithm `lecture5-browser-30hz-v2`. Feature order stays knee, hip, elbow, trunk. Original normalized landmarks are retained; aspect/mirror corrections affect analytical features only. Raw missing values and unavailable web-SDK presence are null. `fps`, indices and counts describe the 30 Hz sample grid; `sampling_method` records that explicitly.

## Worker and decoder decisions

MediaPipe detectForVideo is synchronous; a dedicated worker keeps React responsive. The pinned WASM loader uses importScripts, so the TypeScript worker is compiled as a classic worker; it dynamically imports the same-origin SDK. No extra worker framework/bundler. Each video gets a new detector to reset tracking. CPU delegate is explicit. Model SHA-256 is checked at build and inference.

Acquisition seeks to sample_index/30, waits for decoding, transfers an ImageBitmap, awaits pose output, then advances. It avoids inference-driven playback frame drops but is not a native-frame demuxer. Source frames may repeat or be skipped. This new scientific assumption is not hidden in the UI.

## Lifecycle

- One run per page; disabled controls and synchronous guard prevent duplicate starts.
- Cancel/unmount aborts fetch/seeking and terminates the worker. Bitmap, video and blob URLs are released on success/error/cancel.
- No candidate upload request, localStorage or IndexedDB persistence.
- One reference landmark sequence is cached in page memory by content hash. Settings are recomputed from raw landmarks. Identical-file reuse is labeled self-comparison.
- Missing/corrupt assets, unsupported browser/codec, limits, known frontal input, long gaps and no complete stroke fail without scores.
- Input/settings changes clear old results. Failed/cancelled runs cannot leave an old score visible.
- Public asset HTTP caching is distinct from selected local files and exported reports.

## Reference and unresolved work

`references/python/` archives former Python code/tests and a synthetic fixture generator. It is optional reference material, not a backend and not included in dist.

TODO: video-distribution consent; independent side-view data; manual annotation validation; real iOS/Android performance; cross-browser decoding/inference repeatability; native-frame timestamps if required by the study; deeper dependency/network auditing. This migration does not publish a live Netlify site.
