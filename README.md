# IQRow

A **frontend-only React + TypeScript** rowing-motion research workspace for **Netlify static hosting**. Pose estimation, angles, stroke detection and scoring run in the visitor's browser. No Python server, API endpoint, Netlify Function, database or API key is required.

Research prototype only: not a medical or validated technique-assessment product.

## Run locally

Use Node 22 LTS (also configured for Netlify):

```powershell
npm ci
npm run dev
```

Open Vite's local URL. The first start/build downloads and verifies the notebook's Heavy model if not cached. This is a build-time asset download, not cloud inference. Source files remain unchanged.

## Deploy to Netlify

The included `netlify.toml` sets:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`
- No backend, functions, API proxy or secrets

Connect your Git repository to Netlify using the project root as the base directory. Include `package-lock.json`, `scripts/`, `src/`, `netlify.toml` and the original `source/` files. Generated static assets are ignored and recreated during build.

For manual deployment:

```powershell
npm ci
npm run build
```

Upload the **complete `dist` folder** to Netlify—not the source folder or just index.html. The generated site is about 54 MB, mostly model/WASM. Keep its media, vendor, models, manifest and worker files.

**Before publishing:** bundled coach/candidate recordings become publicly accessible site assets. Obtain permission to distribute both. Selected user files are processed locally, not uploaded.

See [Netlify's Vite guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/). This single-page app uses tab state, not history routes, so it needs no catch-all rewrite.

## Tests and production preview

```powershell
npm test
npm run build
npm run preview
```

Open the preview URL, normally http://127.0.0.1:4173. No Python process is needed. Tests compare TypeScript against reproducible Python-generated **synthetic fixtures**, with absolute Float64 tolerance 1e-9. That is numerical software equivalence, not pose accuracy. See [optional reference instructions](references/python/README.md).

## Use

1. Review the reference and **Method & limits**.
2. Select/drop one supported fixed full-body side-view video, and confirm capture suitability.
3. Choose pixel-corrected or original notebook coordinates and the candidate's facing direction.
4. Click **Analyze & compare**. The coach profile is precomputed; actual sampled-frame progress covers only the candidate. Allow several minutes on slower devices. **Cancel analysis** stops the worker.
5. Inspect six feature curves, the weighted difference, per-stroke mean±SD, absolute curve area, raw/interpolated/smoothed signals, catches and timing. Edit the displayed weights to run a sensitivity check without reanalyzing the video. **View catch** seeks to a sampled boundary.
6. Export JSON/CSV with permission: reports contain landmarks and file hashes.

RMSE is a difference in degrees, not a 0–100 grade, safety rating or injury prediction. Neck/wrist values are provisional 2D proxies. The default rank-sum weights are an editable project hypothesis, not validated biomechanical importance. Notes identify differences to discuss with a coach.

## Scientific and technical limits

The supplied `Video.mov` reference is side-facing; `Video_1.mov` is front-facing. The latter is previewable but rejected from scoring, including renamed copies. Use another side-view clip for independent evaluation. Selecting the reference itself is an explicitly labeled self-comparison software check.

- Browser-supported MP4/MOV/M4V/WebM: actual codec must decode in the browser. H.264 MP4 is a practical choice.
- Engineering limits: 100 MiB, 120 s, 3,600 sampled frames, 4K, one active run per page—not scientific thresholds.
- **Schema v3 sampling:** seek at 30 Hz. `fps`, frame indices and counts refer to the sample grid, not native encoded frames. Original frames can repeat or be skipped. This is not exact OpenCV frame extraction.
- Same Heavy model, pinned MediaPipe Web 0.10.21, CPU worker. Browser/Python inference parity is unproven. Web-SDK presence is unavailable and exported as null.
- App requests only static assets from its origin; it contains no video-upload request. A versioned coach profile is computed before deployment, copied as a static asset and integrity-checked in the browser. Results are not persisted by the app; reload/close clears app state. Public HTTP asset caching is separate.
- HTTPS or localhost, WebAssembly, Workers, OffscreenCanvas and ImageBitmap are required. Real-device mobile performance and cross-browser scientific repeatability remain TODO.

## Project guide

[Project](docs/PROJECT.md) · [Science](docs/SCIENCE.md) · [Architecture](docs/ARCHITECTURE.md) · [Workflow](docs/WORKFLOW.md) · [Decisions](docs/DECISIONS.md) · [UI](docs/UI_SPEC.md) · [Glossary](docs/GLOSSARY.md) · [Source inventory](references/README.md)

Original notebook/videos are unchanged. Former Python code/tests are archived under `references/python/` for reproducibility, never built/executed/published by the web app.

Project repository: [FastTrack-Academy/SmartRow](https://github.com/FastTrack-Academy/SmartRow), branch `main`.
