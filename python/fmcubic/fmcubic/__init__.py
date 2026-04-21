"""
fmcubic — Fernández Molina cubic equation solver.

Reference:
  Fernández Molina, J. M., et al. (2022).
  "A series-based analytical solution to the cubic equation."
  AIP Advances 12, 045002.

Public API:
  solve_cubic(A, B, C, D, tol=1e-12, max_terms=200) -> SolveResult
"""
from .core import (
    solve_cubic,
    SolveResult,
    Complex,
    depress,
    classify_stability,
    vieta_residuals,
)
from .benchmark import (
    PATEL_TEJA_CASES,
    run_patel_teja_validation,
)

__all__ = [
    "solve_cubic",
    "SolveResult",
    "Complex",
    "depress",
    "classify_stability",
    "vieta_residuals",
    "PATEL_TEJA_CASES",
    "run_patel_teja_validation",
]

__version__ = "0.1.0"
