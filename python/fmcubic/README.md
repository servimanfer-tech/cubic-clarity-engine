# fmcubic

A serious, honest Python implementation of the **Fernández Molina** series
method for cubic equations.

> **Reference:** Fernández Molina, R. A., Sigalotti, L. Di G., Rendón, O.,
> & Mejías, A. J. (2022). *A rapidly convergent method for solving
> third-order polynomials.* AIP Advances **12**, 045002.
> https://doi.org/10.1063/5.0073851

**Authors of the mathematical method:**
Ramón A. Fernández Molina · Leonardo Di G. Sigalotti · Otto Rendón · Antonio J. Mejías

Reference Python implementation of the method. Explicit about what is
faithful to the paper and what is a practical fallback in IEEE-754 double
precision.

---

## Install

```bash
pip install -e .
# or just drop the `fmcubic/` folder next to your code
```

Requires Python ≥ 3.11 (uses `math.cbrt`).

## Usage

```python
from fmcubic import solve_cubic

res = solve_cubic(1, -6, 11, -6)
print(res.method)        # → "Fernández Molina (trigonometric fallback, Δ<0)"
print(res.branch)        # → "trig-viete"
print(res.iterations)    # → 1
for r in res.roots:
    print(r)             # → 1, 2, 3
print(res.notes)
```

`solve_cubic` returns a `SolveResult` with:

| field                | meaning                                          |
|----------------------|--------------------------------------------------|
| `roots`              | three `Complex(re, im)` roots                    |
| `method`             | human-readable branch label                      |
| `branch`             | machine tag (`series-A-Eq17`, `trig-viete`, …)   |
| `iterations`         | series terms or Newton iterations                |
| `convergence_trace`  | per-step approximation of x₁                     |
| `p`, `q`, `delta`    | depressed-cubic invariants                       |
| `ratio`              | `q²/(4Δ)` — the series convergence ratio         |
| `notes`              | free-form caveats                                |

## Branch tree

| Tag             | Condition                | Origin in paper        | Status                |
|-----------------|--------------------------|------------------------|-----------------------|
| `triple-root`   | p≈0 ∧ q≈0                | trivial                | **paper-faithful**    |
| `p-axis-Eq57`   | p≈0, q≠0                 | Eq. (57)               | **paper-faithful**    |
| `delta-zero`    | Δ≈0                      | closed form            | **paper-faithful**    |
| `curve-Eq37-58` | p³ + 27q²/2 ≈ 0          | Eq. (37) + (58)        | **paper-faithful**    |
| `series-A-Eq17` | Δ>0, |q²/(4Δ)| < 1       | Eq. (17)               | **paper-faithful**    |
| `series-B-Eq30` | Δ>0, |q²/(4Δ)| > 1       | Eq. (30)               | **paper-faithful**    |
| `buffer-newton` | ||ratio|−1| < 0.05       | —                      | practical fallback     |
| `trig-viete`    | Δ < 0                    | Viète                  | numerical equivalent   |

The complex-branch series proposed in the paper for **Δ<0** is *not*
implemented faithfully — we use Viète's trigonometric form, which is
mathematically exact but is a substitution, not a faithful execution.

## Numerical honesty

The `solve_cubic` docstring spells this out, and the Patel-Teja benchmark
demonstrates it:

* `Δ = q²/4 + p³/27` suffers **catastrophic cancellation** when q²/4 ≈
  −p³/27 (e.g. Patel-Teja case V: ~10⁵¹ + ~10⁵¹ → ~10³⁷). In double
  precision this leaves ~2 significant digits of Δ.
* The series method consumes the *ratio* 4Δ/q², which is far less
  sensitive — but any caller using Δ directly should be aware.
* Some polynomials evaluate to `f(x) == 0.0` exactly in IEEE-754 at a
  point that **does not satisfy Vieta's relations** (spurious zero).
  Use `vieta_residuals(A, B, C, D, roots)` to detect this.

## Patel-Teja benchmark

```python
from fmcubic import run_patel_teja_validation

report = run_patel_teja_validation()
print("OK?" , report.overall_pass)
for cr in report.cases:
    print(cr.case.id, "Δ=", cr.delta, "pass=", cr.pass_overall)
    for m in cr.methods:
        print(" ", m.method, m.picked, "vieta-sum=", m.vieta["sum"])
```

| Case | Conditioning      | Validation criterion               |
|------|-------------------|------------------------------------|
| Z    | severe (Δ ≈ 10⁻³⁴) | FM↔Cardano consensus               |
| ρ    | well conditioned  | FM matches paper to <1e-7 %         |
| V    | extreme (10⁵¹+10⁵¹)| FM↔Cardano consensus + Vieta check |

## Tests

```bash
python -m pip install pytest
python -m pytest -q
```

Covers: triple root, p=0/q≠0, Δ=0, three real roots, complex conjugates,
extreme coefficients, buffer zone, Patel-Teja Z/ρ/V, and Vieta consistency.

## What's faithful and what isn't (one-page summary)

**Faithful to the paper:**
- Depression to `y³ + py + q = 0` and shift recovery.
- All four closed-form special cases (B1-B4) including the special
  curve `p³ + 27q²/2 = 0` (Eqs. 37 + 58).
- Series A (Eq. 17) and Series B (Eq. 30) with **incremental binomial
  recurrence** `c_{i+1} = c_i · (1/3 − i)/(i+1)`.
- Stabilized Eq. (51)-(53) deflation Γ for the other two roots.

**Practical / equivalent:**
- Trigonometric (Viète) form for **Δ<0** — paper proposes a complex
  series; we substitute the closed form.
- A small **buffer zone** around |ratio|=1 that switches to
  Newton-Raphson because the series convergence is impractically slow
  there.

**Not yet implemented:**
- The complex-branch series for Δ<0.
- Extended-precision (≥128-bit) mode required to reproduce Patel-Teja
  cases Z and V exactly.

---

Mathematical method © Fernández Molina, Sigalotti, Rendón & Mejías (2022).
Please cite: AIP Advances 12, 045002. https://doi.org/10.1063/5.0073851
