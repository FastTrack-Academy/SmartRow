# Project

This document was created for the first web implementation. It records the user brief and inspected notebook; it is not a pre-existing approved specification.

## Workflow

- **User:** student researcher and a rower/coach reviewing a recording. Broader user research is TODO.
- **Problem:** make video-derived movement patterns inspectable and comparable with a user-designated coach video.
- **Input:** one candidate recording and the supplied reference; coordinate mode, facing direction, and user-confirmed capture suitability.
- **Automation:** video decoding → MediaPipe pose estimation → active-side selection → four angle signals → interpolation → smoothing → catches/finishes → 100-point fingerprints → per-feature and aggregate RMSE → deterministic review notes.
- **Output:** measured estimates, raw landmarks, angle curves, timing, similarity distances, quality indicators, limitations, downloadable report.
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
| Wrist and neck notes | Defer | Definitions and validation are unresolved |

No README, AGENTS, docs, references directory, prototypes directory or Git history existed at initial inspection. The source notebook was the only scientific document. No additional dataset or validated scoring rubric was supplied.

## Next research milestone

Current software target: frontend-only Netlify static hosting, explicitly requested after the initial local-service implementation. Browser acquisition samples at 30 Hz; see SCIENCE and DECISIONS for the versioned change. The old Python implementation remains optional reference material only.

Record a second side-view video using comparable framing and camera placement. Have a coach label catches/finishes and review manually annotated joint angles before calibrating any technique score.
