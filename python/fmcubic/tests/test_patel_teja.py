"""Patel-Teja benchmark tests — mirror the TypeScript suite."""
import pytest

from fmcubic import run_patel_teja_validation, PATEL_TEJA_CASES
from fmcubic.benchmark import FM_TOLERANCE_PCT, CONSENSUS_TOLERANCE_PCT


report = run_patel_teja_validation()


def test_three_cases_present():
    assert [c.case.id for c in report.cases] == ["Z", "rho", "V"]


@pytest.mark.parametrize("tc", PATEL_TEJA_CASES, ids=lambda c: c.id)
def test_fm_returns_real_finite_root(tc):
    cr = next(c for c in report.cases if c.case.id == tc.id)
    fm = next(m for m in cr.methods if m.method == "Fernández Molina")
    assert fm.is_real
    assert fm.picked == fm.picked  # not NaN


@pytest.mark.parametrize("tc", PATEL_TEJA_CASES, ids=lambda c: c.id)
def test_fm_cardano_consensus(tc):
    cr = next(c for c in report.cases if c.case.id == tc.id)
    fm = next(m for m in cr.methods if m.method == "Fernández Molina")
    cd = next(m for m in cr.methods if m.method == "Cardano")
    assert fm.error_vs_consensus_pct < CONSENSUS_TOLERANCE_PCT
    assert cd.error_vs_consensus_pct < CONSENSUS_TOLERANCE_PCT


@pytest.mark.parametrize("tc", PATEL_TEJA_CASES, ids=lambda c: c.id)
def test_paper_fidelity_or_documented_gap(tc):
    cr = next(c for c in report.cases if c.case.id == tc.id)
    fm = next(m for m in cr.methods if m.method == "Fernández Molina")
    if tc.double_precision_limited:
        # Honest: only require finite, documented gap.
        assert fm.error_vs_paper_pct == fm.error_vs_paper_pct  # not NaN
        assert cr.pass_overall  # passes via consensus
    else:
        assert fm.error_vs_paper_pct < FM_TOLERANCE_PCT
        assert cr.pass_overall


def test_overall_benchmark_passes():
    assert report.overall_pass


@pytest.mark.parametrize("tc", PATEL_TEJA_CASES, ids=lambda c: c.id)
def test_cardano_failure_flagged_when_documented(tc):
    if not tc.cardano_fails_in_paper:
        pytest.skip("Not flagged as Cardano-fails in paper.")
    cr = next(c for c in report.cases if c.case.id == tc.id)
    cd = next(m for m in cr.methods if m.method == "Cardano")
    assert cd.fail_expected
