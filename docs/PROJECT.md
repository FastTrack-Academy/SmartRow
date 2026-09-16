# Project

This document was created for the first web implementation. It records the user brief and inspected notebook; it is not a pre-existing approved specification.

## Workflow

- **User:** student researcher and a rower/coach reviewing a recording. Broader user research is TODO.
- **Problem:** make video-derived movement patterns inspectable and comparable with a user-designated coach video.
- **Input:** one candidate recording and the supplied reference; coordinate mode, facing direction, and user-confirmed capture suitability.
- **Automation:** load precomputed fixed coach profile; candidate decoding → MediaPipe pose estimation → active-side selection → six angle/proxy signals → interpolation → smoothing → catches/finishes → 100-point fingerprints → RMSE/absolute curve area/stroke variability → editable weighted RMSE → deterministic review notes.
- **Output:** measured estimates, raw landmarks, six curves, timing, feature differences, one weighted difference in degrees, per-stroke SD, quality indicators, limitations, downloadable report.
- **User action:** review pose tracking and stroke boundaries, discuss differences with a coach, export data, and record a better controlled clip. No medical decisions are supported.

## Reuse inventory

| Material | Decision | Rationale |
|---|---|---|
| Original notebook | Retain unchanged | Educational provenance and parity-test reference |
| Angle/resampling functions | Port preserved Python reference to TypeScript | Netlify frontend-only requirement; numerical parity fixtures |
| MediaPipe Heavy model | Retain model asset | Exact URL in notebook |
| Colab upload/display and inline plots | Replace with React UI/browser workers | No Python or HTTP API at deployment |
| Within-video held-out last-stroke demonstration | Retain as source; extend explicitly | New application compares all candidate strokes against a separate reference mean |
| Notebook cached outputs | Do not treat as new results | They belong to the original demonstration |
| Coach video | Retain as user-designated reference | Coach validation/consent still TODO |
| Supplied candidate | Retain for preview and rejection test | Front-facing view violates the side-view assumption |
| Wrist and neck notes | Implement as labeled 2D proxies | Definitions are explicit; manual validation remains unresolved |

No README, AGENTS, docs, references directory, prototypes directory or Git history existed at initial inspection. The source notebook was the only scientific document. No additional dataset or validated scoring rubric was supplied.

## Next research milestone

Current software target: frontend-only Netlify static hosting, explicitly requested after the initial local-service implementation. Browser acquisition samples at 30 Hz; see SCIENCE and DECISIONS for the versioned change. The old Python implementation remains optional reference material only.

Record controlled side-view videos from multiple rowers using comparable framing and camera placement. Have a coach label catches/finishes and independently annotate all six signals. Pre-register how the editable weights will be validated on held-out rowers before treating the weighted distance as a performance measure.
