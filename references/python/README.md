# Preserved Python reference — not the deployed backend

The first Python implementation/tests are archived here for numerical reproducibility. React and Netlify do not import, start, install or publish them. Do not start the old HTTP adapter to use the current app. Original notebook/videos remain under the root source directory. Archive path references were adjusted after moving.

## Optional fixture regeneration

The committed src/analysis/__fixtures__/python-parity.json contains **synthetic software fixtures, not athlete measurements**. Initial generator versions: NumPy 1.26.4, pandas 2.2.3, SciPy 1.11.4. Browser tests use this JSON with Node alone.

From the project root, using the previous isolated environment:

```powershell
.\.venv\Scripts\python.exe references/python/generate_fixtures.py
npm test
```

To recreate the optional environment, use Python 3.11 and install references/python/backend/requirements.txt. This is not needed for frontend development/build/deploy.

Preserved test suite:

```powershell
Push-Location references/python
..\..\.venv\Scripts\python.exe -m pytest tests -q
Pop-Location
```

Tests compare reviewed notebook functions with the preserved Python implementation, then TypeScript with generated numerical fixtures: angles, coordinates/mirroring, interpolation, reflected Gaussian smoothing, peaks/catches/finishes, fingerprints and RMSE. Index fixtures require exact equality; Float64 arrays use absolute 1e-9.

SciPy does not promise tie order for equal-height competing peaks. TypeScript explicitly prefers the later index; larger degenerate tie sets may differ. See SCIENCE.md for this caveat and the 30 Hz acquisition change. These tests do not establish cross-runtime model parity or scientific validity.
