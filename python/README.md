# Python sidecar — `fmcubic`

This folder hosts the **reference Python implementation** of the
Fernández Molina cubic series method. It lives next to the React/Vite
web app but is **completely independent** from it: the dashboard does
not import, run, or depend on this code in any way.

> Source: `fmcubic_clean_1.zip` provided by the user (corrected by
> Claude). Integrated as-is, no rewrites.

## Why it's here

- Versioned next to the TypeScript solver (`src/lib/cubicSolvers.ts`)
  so both implementations evolve together.
- Lets contributors validate numerical claims of the dashboard against
  a paper-faithful Python reference.
- Documents honestly what is faithful to the paper and what is a
  practical fallback (see `fmcubic/README.md`).

## Layout

```
python/
└── fmcubic/                 ← Python package root
    ├── pyproject.toml
    ├── README.md            ← full library docs (branches, benchmark, honesty notes)
    ├── LICENSE              ← MIT
    ├── fmcubic/
    │   ├── __init__.py
    │   ├── core.py          ← solve_cubic + branch tree B1–B7
    │   └── benchmark.py     ← Patel–Teja Z / ρ / V validation
    └── tests/
        ├── test_solver.py        ← 9 unit tests
        └── test_patel_teja.py    ← 14 benchmark tests
```

## Install & run locally

```bash
cd python/fmcubic
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e . pytest
pytest -q
```

Last verified: **22 passed, 1 skipped** (the skipped case is documented
inside the test — Cardano success is not flagged as failure for
case ρ).

## Quick usage

```python
from fmcubic import solve_cubic, run_patel_teja_validation

res = solve_cubic(1, -6, 11, -6)
print(res.branch, res.iterations, [(r.re, r.im) for r in res.roots])

report = run_patel_teja_validation()
print("overall pass:", report.overall_pass)
```

## Branch coverage (B1–B7)

| Tag             | Status               |
|-----------------|----------------------|
| `triple-root`   | paper-faithful       |
| `p-axis-Eq57`   | paper-faithful       |
| `delta-zero`    | paper-faithful       |
| `curve-Eq37-58` | paper-faithful       |
| `series-A-Eq17` | paper-faithful       |
| `series-B-Eq30` | paper-faithful       |
| `buffer-newton` | practical fallback   |
| `trig-viete`    | numerical equivalent (Δ<0; complex series not implemented) |

Full details, caveats and the Patel–Teja validation criteria live in
[`fmcubic/README.md`](./fmcubic/README.md).

## What this folder does NOT do

- Does not get bundled by Vite (the build ignores non-source folders
  outside `src/`).
- Does not replace `src/lib/cubicSolvers.ts` — the dashboard keeps
  using its own TypeScript solver.
- Does not require Python to be installed to build or run the web app.
