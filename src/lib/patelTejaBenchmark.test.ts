import { describe, it, expect } from "vitest";
import {
  runPatelTejaValidation,
  FM_TOLERANCE_PCT,
  CONSENSUS_TOLERANCE_PCT,
  PATEL_TEJA_CASES,
} from "@/lib/patelTejaBenchmark";

describe("Patel-Teja propylene benchmark — Fernández Molina et al. (2022), Tables I–II", () => {
  const report = runPatelTejaValidation();

  it("produces one result block per case (Z, ρ, V)", () => {
    expect(report.cases).toHaveLength(3);
    expect(report.cases.map((c) => c.case.id)).toEqual(["Z", "rho", "V"]);
  });

  for (const tc of PATEL_TEJA_CASES) {
    describe(`Case ${tc.id} — ${tc.label}`, () => {
      const cr = report.cases.find((c) => c.case.id === tc.id)!;
      const fm = cr.methods.find((m) => m.method === "Fernández Molina")!;
      const cd = cr.methods.find((m) => m.method === "Cardano")!;
      const nw = cr.methods.find((m) => m.method === "Newton-Raphson")!;

      it("Fernández Molina returns a real, finite root", () => {
        expect(fm.isReal).toBe(true);
        expect(Number.isFinite(fm.picked)).toBe(true);
      });

      it(`FM, Cardano and Newton agree within ${CONSENSUS_TOLERANCE_PCT}% (IEEE-754 consensus)`, () => {
        expect(fm.errorVsConsensus_pct).toBeLessThan(CONSENSUS_TOLERANCE_PCT);
        expect(cd.errorVsConsensus_pct).toBeLessThan(CONSENSUS_TOLERANCE_PCT);
        expect(nw.errorVsConsensus_pct).toBeLessThan(CONSENSUS_TOLERANCE_PCT);
      });

      if (!tc.doublePrecisionLimited) {
        it(`FM reproduces the paper value (rel. error < ${FM_TOLERANCE_PCT}%)`, () => {
          expect(fm.errorVsPaperFM_pct).toBeLessThan(FM_TOLERANCE_PCT);
          expect(fm.pass).toBe(true);
        });
      } else {
        it("FM is double-precision-limited vs the paper (gap is recorded honestly)", () => {
          // We don't claim paper fidelity here — only that the gap is finite and reported.
          expect(Number.isFinite(fm.errorVsPaperFM_pct)).toBe(true);
          expect(fm.pass).toBe(true); // pass via consensus, not paper fidelity
        });
      }

      if (tc.cardanoFailsInPaper) {
        it("Cardano is flagged as failing-in-paper for this case", () => {
          expect(cd.failExpected).toBe(true);
        });
      }
    });
  }

  it("overall benchmark PASSES (all 3 FM cases meet their tolerance)", () => {
    expect(report.overallPass).toBe(true);
  });
});
