import { describe, it, expect } from "vitest";
import {
  runPatelTejaValidation,
  FM_TOLERANCE_PCT,
  CARDANO_FAIL_THRESHOLD_PCT,
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

      it(`Fernández Molina reproduces the paper value (rel. error < ${FM_TOLERANCE_PCT}%)`, () => {
        expect(fm.errorVsPaperFM_pct).toBeLessThan(FM_TOLERANCE_PCT);
        expect(fm.isReal).toBe(true);
        expect(fm.pass).toBe(true);
      });

      it("Fernández Molina also matches the experimental reference value closely", () => {
        // Allow same paper-grade tolerance vs experimental
        expect(fm.errorVsExperimental_pct).toBeLessThan(1e-3);
      });

      if (tc.cardanoFails) {
        it(`Cardano fails as documented (rel. error > ${CARDANO_FAIL_THRESHOLD_PCT}%)`, () => {
          expect(cd.errorVsPaperFM_pct).toBeGreaterThan(CARDANO_FAIL_THRESHOLD_PCT);
          expect(cd.failExpected).toBe(true);
          expect(cd.pass).toBe(true); // pass = "failed as expected"
        });
      } else {
        it("Cardano works correctly on this case", () => {
          expect(cd.errorVsPaperFM_pct).toBeLessThan(1e-3);
        });
      }

      it("Newton-Raphson converges to the physical root", () => {
        expect(nw.errorVsPaperFM_pct).toBeLessThan(1e-3);
      });

      it("records the number of series terms used by FM", () => {
        expect(fm.iterations).toBeGreaterThan(0);
        expect(Number.isFinite(fm.iterations)).toBe(true);
      });
    });
  }

  it("overall benchmark PASSES (all 3 FM cases within tolerance)", () => {
    expect(report.overallPass).toBe(true);
  });
});
