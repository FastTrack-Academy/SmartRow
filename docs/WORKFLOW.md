# Development workflow

1. Read README, PROJECT, SCIENCE, ARCHITECTURE, DECISIONS, UI_SPEC and relevant source material before modifying analysis.
2. State feature, workflow stage, changed modules, reused evidence and verification method.
3. Inspect repository status. There was no Git repository at project start; initialize version control when ready and commit coherent milestones. Do not rewrite source recordings/notebooks or unrelated changes.
4. Prefer one inspectable stage at a time. The first milestone integrates the notebook's existing stages, rather than adding new wrist/neck or injury logic.
5. Update src/contracts.ts when changing current report shapes; the archived Python schema documents v1. Distinguish null raw data from imputed values. Keep stable feature ordering and units. Regenerate the versioned coach profile whenever feature or preprocessing definitions change.
6. Run npm test and npm run build, then test npm run preview without a Python server. Check real browser inference, cancellation, error states, exports and mobile-sized layout. Python tests/fixture regeneration are optional reference checks, not deployment prerequisites.
7. Record scientific or architectural changes in DECISIONS and SCIENCE. Synthetic fixtures, cached notebook results and self-comparison are not independent experimental evidence.
8. Report completed changes, unresolved questions, test procedure, assumptions and the next research step.

Recommended next coherent commit after review: `feat: add precomputed coach profile and six-feature weighted scoring`.
