"""Test battery for fmcubic.solve_cubic."""
import math
import pytest

from fmcubic import solve_cubic, vieta_residuals, classify_stability
from fmcubic.core import depress, FM_BUFFER_DELTA


# ---------------------------------------------------------------- helpers
def _sorted_real(res):
    return sorted([r.re for r in res.roots if r.is_real(1e-6)])


def _vieta_ok(A, B, C, D, res, tol=1e-6):
    v = vieta_residuals(A, B, C, D, res.roots)
    assert v["sum"]       < tol, v
    assert v["sum_pairs"] < tol, v
    assert v["product"]   < tol, v


# ---------------------------------------------------------------- B1
def test_triple_root():
    # (x - 2)^3 = x^3 -6x^2 +12x -8
    res = solve_cubic(1, -6, 12, -8)
    assert res.branch == "triple-root"  # depressed form gives p=q=0
    for r in res.roots:
        assert math.isclose(r.re, 2.0, abs_tol=1e-9)


# ---------------------------------------------------------------- B2
def test_p_zero_q_nonzero():
    # y^3 + q = 0 with q = -8 ⇒ root y=2; we work directly on depressed form
    # by feeding A=1, B=0, C=0, D=-8.
    res = solve_cubic(1, 0, 0, -8)
    assert res.branch == "p-axis-Eq57"
    real = _sorted_real(res)
    assert math.isclose(real[0], 2.0, abs_tol=1e-9)
    # Plus a complex-conjugate pair
    complex_roots = [r for r in res.roots if not r.is_real(1e-6)]
    assert len(complex_roots) == 2


# ---------------------------------------------------------------- B3
def test_delta_zero_double_root():
    # (x-1)^2 (x+2) = x^3 - 3x + 2 ⇒ A=1, B=0, C=-3, D=2 — has Δ=0
    res = solve_cubic(1, 0, -3, 2)
    # All three roots must be real and Vieta-consistent
    _vieta_ok(1, 0, -3, 2, res)
    real = _sorted_real(res)
    assert len(real) == 3


# ---------------------------------------------------------------- B5
def test_three_real_roots():
    # (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6 ⇒ Δ<0
    res = solve_cubic(1, -6, 11, -6)
    real = _sorted_real(res)
    assert len(real) == 3
    for got, want in zip(real, [1.0, 2.0, 3.0]):
        assert math.isclose(got, want, abs_tol=1e-9)


# ---------------------------------------------------------------- complex
def test_complex_conjugate_pair():
    # x^3 + x + 10 — has one real root and a complex pair
    res = solve_cubic(1, 0, 1, 10)
    reals = [r for r in res.roots if r.is_real(1e-6)]
    complexes = [r for r in res.roots if not r.is_real(1e-6)]
    assert len(reals) == 1
    assert len(complexes) == 2
    # Conjugates: imag parts must be opposite, real parts equal
    assert math.isclose(complexes[0].re, complexes[1].re, abs_tol=1e-9)
    assert math.isclose(complexes[0].im, -complexes[1].im, abs_tol=1e-9)
    _vieta_ok(1, 0, 1, 10, res)


# ---------------------------------------------------------------- extreme
def test_extreme_coefficients():
    A, B, C, D = 1.0, -1e6, 2.5e11, -1.25e16
    res = solve_cubic(A, B, C, D)
    _vieta_ok(A, B, C, D, res, tol=1e-3)


# ---------------------------------------------------------------- buffer zone
def test_buffer_zone_triggers_newton():
    """Construct a polynomial whose |q²/(4Δ)| ≈ 1 and check we land in B6.

    Algebra: choose q=2, target ratio = 1+eps with eps=0.02. Then
        p³/27 = -q²/4 · eps/(1+eps) = -0.0196  ⇒  p = -0.8089677...
    Resulting ratio = 1.02, comfortably inside the ±0.05 buffer.
    """
    q = 2.0
    eps = 0.02
    p3_over_27 = -1.0 * eps / (1.0 + eps)
    p = -((-27.0 * p3_over_27) ** (1.0 / 3.0))
    res = solve_cubic(1, 0, p, q)
    assert res.branch == "buffer-newton", res.branch
    _vieta_ok(1, 0, p, q, res, tol=1e-6)


# ---------------------------------------------------------------- stability
def test_classify_stability_smoke():
    s = classify_stability(1, -6, 11, -6)
    assert s["level"] in ("green", "yellow", "red")


# ---------------------------------------------------------------- input guard
def test_zero_leading_coefficient_raises():
    with pytest.raises(ValueError):
        solve_cubic(0, 1, 2, 3)
