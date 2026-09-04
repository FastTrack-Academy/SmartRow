# Interface specification

First-milestone design: white research workspace, dark navy text, teal actions, muted gray-blue labels, orange candidate curves. System sans-serif; desktop max width 1260px including gutters; two equal video columns; stacked mobile layout at 640px. No fabricated results on first load.

## Screens and states

- Header: IQRow, Compare, Method & limits; browser workspace label.
- Input: real reference video and upload drop area; choose-file and supplied-candidate preview actions.
- Selection: real candidate preview, clear/replace controls, capture confirmation; known frontal clip displays a blocking explanation.
- Settings: Pixel-corrected or Notebook original; same/opposite facing.
- Processing: controls disabled, actual sampled-frame counts/progress bar and Cancel analysis button. Model initialization is indeterminate; no invented percentage. State that video stays in the browser.
- Results: RMSE, four feature selectors, reference mean±SD and candidate mean/individual stroke, phase RMSE table, review notes.
- Inspector: raw/interpolated/smoothed time series, coverage and missing-data warnings, catches, stroke table, seek-to-catch, CSV/JSON exports, provenance and limitations.
- Errors: unsupported browser/codec, empty/oversize file, missing/incompatible static assets, known unsuitable view, missing pose/long gaps/no complete strokes; no residual score after a new run fails or is cancelled.
- Method: source workflow, 30 Hz browser seek sampling, mathematical definition, settings, restrictions, validation TODOs and browser-local data handling. No Python setup instructions in the interface.

## Design source and intentional adaptations

An image-generated concept was used for layout planning. Real supplied video replaces its invented water-rowing image; generated imagery is never used as evidence or a video substitute. Disabled analyze state, capture confirmation, resource-limit text, unsuitable-view warning and self-check labels are necessary scientific/usability deviations. Results add the required charts/inspection controls in the same visual system. No stock/generated athlete assets are shipped.

Keep the videos at a native 16:9 review frame with `object-fit: contain`, rather than matching the concept's shortened/cropped reference illustration. This intentionally places the lower sections further down the page. Portrait footage is letterboxed, never stretched or cropped to hide capture problems.

## Accessibility and motion

Semantic headings, labeled controls, keyboard-native buttons/selects, skip link, visible focus, status/error announcements, chart titles, numerical tables and reduced-motion CSS. Pose overlay is noninteractive and never intercepts video controls. Browser codec errors are explicit. A mobile-sized browser test is not a real-device certification.

Charts and tables scroll within their own containers on narrow screens; chart labels stay readable instead of shrinking to a few pixels. The chart region is keyboard-focusable and its accessible label explains horizontal scrolling.
