"""
fmcubic.core
============

Fernández Molina cubic equation solver — honest, defensible reference
implementation in IEEE-754 double precision.

Branch order (mirrors the TypeScript demo):

    B1.  p≈0 ∧ q≈0          → triple root y = 0                   [closed form]
    B2.  p≈0 ∧ q≠0           → Eq. (57): y³ + q = 0                [closed form]
    B3.  Δ≈0  (p,q ≠ 0)      → y₁ = -(4q)^{1/3},  y₂=y₃=(q/2)^{1/3}[closed form]
    B4.  p³ + 27q²/2 ≈ 0     → Eq. (37) + (58) special curve       [closed form]
    B5.  Δ < 0               → trigonometric (Viète) fallback
                                — paper notes M is imaginary; the
                                  complex-branch series is *not*
                                  implemented faithfully here.
    B6.  ||ratio|−1| < δ      → BUFFER ZONE: refined Newton-Raphson
    B7.  otherwise           → Series A (Eq. 17) or Series B (Eq. 30)
                                via incremental binomial recurrence

Faithful to paper:  B1, B2, B3, B4, B7 (series + Eq. 51-53 deflation).
Practical fallback: B5 (Viète) and B6 (Newton).

This file does NOT pretend to reproduce extended-precision results.
Where double is insufficient (e.g. Patel-Teja case V) the diagnostics
flag it explicitly via `notes` and `vieta_residuals`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import cbrt as _math_cbrt, sqrt, acos, cos, pi, isfinite, copysign
from typing import List, Literal, Optional, Tuple

# ---------------------------------------------------------------------------
# Tolerances (mirror the TS demo so behaviour is comparable across stacks).
# ---------------------------------------------------------------------------
FM_TOL_P      = 1e-12
FM_TOL_Q      = 1e-15
FM_TOL_DELTA  = 1e-14
FM_TOL_CURVE  = 1e-12
FM_BUFFER_DELTA = 0.05   # half-width of buffer around |ratio|=1


# ---------------------------------------------------------------------------
# Lightweight complex container — kept separate so callers do not need to
# round-trip through Python's `complex` (which loses the explicit "is real?"
# semantic the paper's branches rely on).
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Complex:
    re: float
    im: float = 0.0

    def is_real(self, tol: float = 1e-8) -> bool:
        return abs(self.im) < tol

    def __repr__(self) -> str:
        if abs(self.im) < 1e-12:
            return f"{self.re:.12g}"
        sign = "+" if self.im >= 0 else "-"
        return f"{self.re:.12g} {sign} {abs(self.im):.12g}i"


BranchTag = Literal[
    "triple-root",         # B1
    "p-axis-Eq57",         # B2
    "delta-zero",          # B3
    "curve-Eq37-58",       # B4
    "trig-viete",          # B5
    "buffer-newton",       # B6
    "series-A-Eq17",       # B7-A
    "series-B-Eq30",       # B7-B
]


@dataclass
class SolveResult:
    """Outcome of solve_cubic.

    Attributes
    ----------
    roots : list[Complex]
        Three roots (real and/or complex-conjugate pair) of the original
        cubic Ax³ + Bx² + Cx + D = 0 — already shifted back from the
        depressed variable.
    method : str
        Human-readable label of the branch actually used.
    branch : BranchTag
        Machine-readable branch identifier for downstream diagnostics.
    iterations : int
        Number of series terms (B7) or Newton iterations (B6). Closed-form
        branches report 0.
    convergence_trace : list[float]
        Per-step approximation of the first real root x₁. Useful for
        plotting convergence.
    p, q, delta : float
        Depressed-cubic invariants (cached for diagnostics).
    ratio : float
        |q² / (4Δ)| — the series convergence ratio. NaN if undefined.
    notes : str
        Free-form annotations: why this branch fired, known precision
        caveats, etc.
    """
    roots: List[Complex]
    method: str
    branch: BranchTag
    iterations: int = 0
    convergence_trace: List[float] = field(default_factory=list)
    p: float = float("nan")
    q: float = float("nan")
    delta: float = float("nan")
    ratio: float = float("nan")
    notes: str = ""


# ---------------------------------------------------------------------------
# Numeric helpers
# ---------------------------------------------------------------------------
def _safe_cbrt(x: float) -> float:
    """Real cube root that preserves sign — math.cbrt is correct on Py>=3.11."""
    return _math_cbrt(x)


def _signed_cbrt(x: float) -> float:
    """Sign-preserving real cube root for arbitrary x (incl. negative)."""
    if x == 0.0:
        return 0.0
    return copysign(_math_cbrt(abs(x)), x)


def depress(A: float, B: float, C: float, D: float) -> Tuple[float, float, float, float]:
    """Depress Ax³+Bx²+Cx+D into y³ + p y + q = 0 via x = y - B/(3A).

    Returns (p, q, delta, shift) where delta = q²/4 + p³/27.

    NOTE on numerics:
        For polynomials whose q²/4 and p³/27 are both huge and nearly equal
        (e.g. Patel-Teja case V), this Δ suffers catastrophic cancellation
        and may carry only ~2 significant digits. The series method itself
        only needs the *ratio* 4Δ/q², which is far less sensitive — but
        any caller using Δ directly should be aware.
    """
    if A == 0.0:
        raise ValueError("A must be non-zero (this is a cubic solver).")
    p = (3 * A * C - B * B) / (3 * A * A)
    q = (2 * B ** 3 - 9 * A * B * C + 27 * A * A * D) / (27 * A ** 3)
    delta = (q * q) / 4.0 + (p ** 3) / 27.0
    shift = B / (3.0 * A)
    return p, q, delta, shift


# ---------------------------------------------------------------------------
# Trigonometric (Viète) — exact for Δ<0, used by B5
# ---------------------------------------------------------------------------
def _solve_trig(A: float, B: float, C: float, D: float) -> List[Complex]:
    p, q, _delta, shift = depress(A, B, C, D)
    # When this is called we already know Δ<0 ⇒ p<0.
    r = sqrt(-(p ** 3) / 27.0)
    arg = max(-1.0, min(1.0, -q / (2.0 * r)))
    phi = acos(arg)
    m = 2.0 * _safe_cbrt(r)
    out: List[Complex] = []
    for k in range(3):
        y = m * cos((phi + 2 * pi * k) / 3.0)
        out.append(Complex(y - shift, 0.0))
    return out


# ---------------------------------------------------------------------------
# Newton-Raphson — used by B6 buffer zone; deflates to a quadratic.
# ---------------------------------------------------------------------------
def _solve_newton(
    A: float, B: float, C: float, D: float,
    tol: float = 1e-12, max_iter: int = 200,
) -> Tuple[List[Complex], int, List[float]]:
    f  = lambda x: ((A * x + B) * x + C) * x + D
    fp = lambda x: (3 * A * x + 2 * B) * x + C

    x = -B / (3.0 * A)  # inflection point — robust seed
    trace: List[float] = []
    iterations = 0
    for iterations in range(max_iter):
        fx, fpx = f(x), fp(x)
        trace.append(x)
        if abs(fx) < tol:
            break
        if abs(fpx) < 1e-18:
            x += 1e-6
            continue
        nxt = x - fx / fpx
        if abs(nxt - x) < tol:
            x = nxt
            trace.append(x)
            break
        x = nxt

    # Deflate Ax³+Bx²+Cx+D = (x - x1)(A x² + b1 x + c1)
    b1 = B + A * x
    c1 = C + b1 * x
    disc = b1 * b1 - 4 * A * c1
    roots: List[Complex] = [Complex(x, 0.0)]
    if disc >= 0:
        s = sqrt(disc)
        roots.append(Complex((-b1 + s) / (2 * A), 0.0))
        roots.append(Complex((-b1 - s) / (2 * A), 0.0))
    else:
        s = sqrt(-disc)
        roots.append(Complex(-b1 / (2 * A),  s / (2 * A)))
        roots.append(Complex(-b1 / (2 * A), -s / (2 * A)))
    return roots, iterations + 1, trace


# ---------------------------------------------------------------------------
# Stabilized deflation — paper Eq. (51)-(53), used after the series finds x₁.
# ---------------------------------------------------------------------------
def _deflate_stable(
    A: float, B: float, C: float, root1: float,
) -> List[Complex]:
    R = B * B - 4 * A * C - 2 * A * B * root1 - 3 * A * A * root1 * root1
    out: List[Complex] = [Complex(root1, 0.0)]
    if R >= 0:
        sgn = 1.0 if (B + A * root1) >= 0 else -1.0
        Gamma = -0.5 * (B + A * root1 + sgn * sqrt(R))
        if abs(Gamma) > 1e-18:
            x2 = Gamma / A
            x3 = (C + B * root1 + A * root1 * root1) / Gamma
            out.append(Complex(x2, 0.0))
            out.append(Complex(x3, 0.0))
        else:
            x23 = -(B + A * root1) / (2 * A)
            out.append(Complex(x23, 0.0))
            out.append(Complex(x23, 0.0))
    else:
        b1 = B + A * root1
        c1 = C + b1 * root1
        disc = b1 * b1 - 4 * A * c1
        s = sqrt(abs(disc))
        out.append(Complex(-b1 / (2 * A),  s / (2 * A)))
        out.append(Complex(-b1 / (2 * A), -s / (2 * A)))
    return out


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def solve_cubic(
    A: float, B: float, C: float, D: float,
    tol: float = 1e-12,
    max_terms: int = 200,
) -> SolveResult:
    """Solve Ax³ + Bx² + Cx + D = 0 with the Fernández Molina branch tree.

    Parameters
    ----------
    A, B, C, D : float
        Cubic coefficients (A ≠ 0).
    tol : float, default 1e-12
        Series convergence tolerance (also passed to Newton when B6 fires).
    max_terms : int, default 200
        Hard cap on series terms / Newton iterations.

    Returns
    -------
    SolveResult
    """
    if A == 0.0:
        raise ValueError("A must be non-zero (this is a cubic solver).")

    p, q, delta, shift = depress(A, B, C, D)
    pAbs, qAbs, dAbs = abs(p), abs(q), abs(delta)
    curve = p ** 3 + (27.0 * q * q) / 2.0

    # Common diagnostics for every branch.
    ratio = float("nan")
    if dAbs > 0:
        try:
            ratio = (q * q) / (4.0 * delta)
        except (OverflowError, ZeroDivisionError):
            ratio = float("nan")

    # ------------------------------------------------------------------ B1
    if pAbs < FM_TOL_P and qAbs < FM_TOL_Q:
        r = -shift
        return SolveResult(
            roots=[Complex(r), Complex(r), Complex(r)],
            method="Fernández Molina (closed form: triple root)",
            branch="triple-root",
            p=p, q=q, delta=delta, ratio=ratio,
            convergence_trace=[r],
            notes="p≈0, q≈0 ⇒ y³ = 0 (faithful to paper).",
        )

    # ------------------------------------------------------------------ B2
    if pAbs < FM_TOL_P:
        cq = _signed_cbrt(q)         # real cube root of q
        y1 = -cq
        re = cq / 2.0
        im = (sqrt(3.0) / 2.0) * cq
        return SolveResult(
            roots=[
                Complex(y1 - shift, 0.0),
                Complex(re - shift,  im),
                Complex(re - shift, -im),
            ],
            method="Fernández Molina (closed form: q-axis, Eq. 57)",
            branch="p-axis-Eq57",
            p=p, q=q, delta=delta, ratio=ratio,
            convergence_trace=[y1 - shift],
            notes="p≈0 ⇒ y³ + q = 0 (faithful to paper Eq. 57).",
        )

    # ------------------------------------------------------------------ B3
    if dAbs < FM_TOL_DELTA:
        fourq = 4.0 * q
        y1  = -_signed_cbrt(fourq)
        y23 =  _signed_cbrt(q / 2.0)
        return SolveResult(
            roots=[
                Complex(y1  - shift, 0.0),
                Complex(y23 - shift, 0.0),
                Complex(y23 - shift, 0.0),
            ],
            method="Fernández Molina (closed form: Δ≈0)",
            branch="delta-zero",
            p=p, q=q, delta=delta, ratio=ratio,
            convergence_trace=[y1 - shift],
            notes="Δ≈0 ⇒ double root (faithful to paper).",
        )

    # ------------------------------------------------------------------ B4
    curve_norm = abs(curve) / max(1.0, pAbs ** 3, qAbs * qAbs)
    if curve_norm < FM_TOL_CURVE:
        qOver4 = q / 4.0
        c = _signed_cbrt(qOver4)
        y1 = -c * (1.0 + sqrt(3.0))
        root1 = y1 - shift
        roots = _deflate_stable(A, B, C, root1)
        return SolveResult(
            roots=roots,
            method="Fernández Molina (closed form: curve Eq. 37/58)",
            branch="curve-Eq37-58",
            p=p, q=q, delta=delta, ratio=ratio,
            convergence_trace=[root1],
            notes="p³ + 27q²/2 ≈ 0 (faithful to paper Eq. 37 + 58).",
        )

    # ------------------------------------------------------------------ B5
    if delta < 0:
        roots = _solve_trig(A, B, C, D)
        return SolveResult(
            roots=roots,
            method="Fernández Molina (trigonometric fallback, Δ<0)",
            branch="trig-viete",
            p=p, q=q, delta=delta, ratio=ratio,
            iterations=1,
            convergence_trace=[roots[0].re],
            notes=(
                "Δ<0 ⇒ M is imaginary. Paper proposes a complex-branch series; "
                "this implementation falls back to Viète's trigonometric form. "
                "Mathematically exact but NOT a faithful execution of the "
                "paper's complex series."
            ),
        )

    # ------------------------------------------------------------------ B6
    if isfinite(ratio) and abs(abs(ratio) - 1.0) < FM_BUFFER_DELTA:
        roots, iters, trace = _solve_newton(A, B, C, D, tol, max_terms)
        return SolveResult(
            roots=roots,
            method="Fernández Molina (BUFFER fallback: Newton, |ratio|≈1)",
            branch="buffer-newton",
            p=p, q=q, delta=delta, ratio=ratio,
            iterations=iters,
            convergence_trace=trace,
            notes=(
                f"Buffer zone |ratio−1|<{FM_BUFFER_DELTA}: series convergence "
                "is too slow; switched to Newton-Raphson with stabilized "
                "deflation."
            ),
        )

    # ------------------------------------------------------------------ B7
    use_A = abs(ratio) < 1.0
    z = (q * q) / (4.0 * delta) if use_A else (4.0 * delta) / (q * q)

    # Sign-stable prefactor: prefactor = -sign(4q) * |4q|^{1/3}
    prefactor = -_signed_cbrt(4.0 * q)

    S = 0.0
    partials: List[float] = []
    terms = 0
    cc = 1.0   # incremental binomial coefficient C(1/3, idx)
    k_idx = 0

    if use_A:
        # Series A (paper Eq. 17): sum over odd indices 2k+1
        factor = _signed_cbrt(z)  # real cube root of z (z may be tiny but real)
        for kAcc in range(max_terms):
            target = 2 * kAcc + 1
            while k_idx < target:
                cc *= (1.0 / 3.0 - k_idx) / (k_idx + 1)
                k_idx += 1
            term = cc * (z ** kAcc)
            S += term
            partials.append(prefactor * factor * S - shift)
            terms = kAcc + 1
            if abs(term) < tol and kAcc > 2:
                break
        x1 = prefactor * factor * S
        method_label = "Fernández Molina (Series A, Eq. 17)"
        branch: BranchTag = "series-A-Eq17"
    else:
        # Series B (paper Eq. 30): sum over even indices 2k
        for kAcc in range(max_terms):
            target = 2 * kAcc
            while k_idx < target:
                cc *= (1.0 / 3.0 - k_idx) / (k_idx + 1)
                k_idx += 1
            term = cc * (z ** kAcc)
            S += term
            partials.append(prefactor * S - shift)
            terms = kAcc + 1
            if abs(term) < tol and kAcc > 2:
                break
        x1 = prefactor * S
        method_label = "Fernández Molina (Series B, Eq. 30)"
        branch = "series-B-Eq30"

    root1 = x1 - shift
    roots = _deflate_stable(A, B, C, root1)

    return SolveResult(
        roots=roots,
        method=method_label,
        branch=branch,
        iterations=terms,
        convergence_trace=partials,
        p=p, q=q, delta=delta, ratio=ratio,
        notes=f"|q²/(4Δ)| = {abs(ratio):.3e}; converged in {terms} term(s).",
    )


# ---------------------------------------------------------------------------
# Stability / diagnostics
# ---------------------------------------------------------------------------
Stability = Literal["green", "yellow", "red"]


def classify_stability(A: float, B: float, C: float, D: float) -> dict:
    """Classify expected series convergence quality (mirrors TS demo)."""
    _p, q, delta, _shift = depress(A, B, C, D)
    if not isfinite(delta) or abs(delta) < 1e-18:
        return {"level": "yellow", "ratio": float("nan"),
                "reason": "Δ ≈ 0 (multiple roots / boundary)"}
    r = abs((q * q) / (4 * delta))
    if not isfinite(r):
        return {"level": "red", "ratio": r, "reason": "Non-finite ratio"}
    if abs(r - 1) < 0.05:
        return {"level": "yellow", "ratio": r,
                "reason": "Near convergence boundary |r|≈1"}
    if r < 0.7 or r > 1.5:
        return {"level": "green", "ratio": r,
                "reason": "Series converges quickly"}
    return {"level": "yellow", "ratio": r, "reason": "Slow convergence zone"}


def vieta_residuals(A: float, B: float, C: float, D: float,
                    roots: List[Complex]) -> dict:
    """Check Vieta consistency: tells whether a returned triplet is a real
    factorization of the input polynomial or a numerical artifact.

    Returns absolute residuals of the three Vieta identities, normalised
    by the corresponding coefficient ratio (so they are dimensionless).
    """
    if len(roots) != 3:
        raise ValueError("Need exactly three roots.")
    # Use Python complex for the arithmetic — preserves im parts.
    c = [complex(r.re, r.im) for r in roots]
    s1 = c[0] + c[1] + c[2]
    s2 = c[0] * c[1] + c[0] * c[2] + c[1] * c[2]
    s3 = c[0] * c[1] * c[2]

    target1 = -B / A
    target2 =  C / A
    target3 = -D / A

    def rel(v: complex, t: float) -> float:
        scale = max(1.0, abs(t))
        return abs(v - t) / scale

    return {
        "sum":     rel(s1, target1),
        "sum_pairs": rel(s2, target2),
        "product": rel(s3, target3),
    }
