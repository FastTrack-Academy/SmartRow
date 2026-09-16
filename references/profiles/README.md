# Coach reference profile

`coach-reference-landmarks-web-v1.json` preserves one measured landmark acquisition of the fixed coach video. It was imported from the browser self-comparison report created on 2026-08-27 with MediaPipe Tasks Vision 0.10.21 and the pinned Heavy model. It is measurement data, not validation evidence.

`coach-reference-browser-30hz-v3.json` is generated from those landmarks by `npm run generate:reference`. It contains both pixel-corrected and notebook-coordinate analytical profiles. The Netlify build copies this artifact into the static site and verifies its SHA-256 at runtime, so a user session analyzes only the candidate video.

If the coach video, landmark model, sampling method, feature definitions, or preprocessing changes, acquire a new landmark file and regenerate this profile. Do not silently reuse an incompatible profile.
