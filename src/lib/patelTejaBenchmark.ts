// Patel-Teja propylene benchmark — Fernández Molina et al. (2022), Tables I-II
// Reproduces published results at T = 95.4 K, P = 1.22e-2 Pa.
// Source: AIP Advances 12, 045002 (2022). DOI: 10.1063/5.0073851

import {
  solveCardano,
  solveFernandezMolina,
  solveNewton,
  type Complex,
  type SolveResult,
} from "./cubicSolvers";

export interface PatelTejaCase {
  id: "Z" | "rho" | "V";
  label: string;
  description: string;
  A: number;
  B: number;
  C: number;
  D: number;
  expectedFM: number;            // value reported by FM in the paper
  expectedExperimental: number;  // experimental reference value
  expectedCardano?: number;      // documented (wrong) Cardano value, where applicable
  cardanoFails: boolean;
  paperErrorFM: number;          // % relative error reported by authors for FM
  paperErrorCardano?: number;    // % relative error reported for Cardano
}

export const PATEL_TEJA_CASES: PatelTejaCase[] = [
  {
    id: "Z",
    label: "Z — compressibility factor",
    description: "Patel–Teja EoS, propylene at 95.4 K, 1.22×10⁻² Pa. Cardano FAILS.",
    A: 1,
    B: -0.999999999563044,
    C: 2.80442339001912e-8,
    D: -2.381380975141026e-17,
    expectedFM: 8.765491017508983e-10,
    expectedExperimental: 8.765491016939650e-10,
    expectedCardano: 9.477104956356890e-8,
    cardanoFails: true,
    paperErrorFM: 6.495e-9,
    paperErrorCardano: 1.071e4,
  },
  {
    id: "rho",
    label: "ρ — reduced density",
    description: "Patel–Teja EoS, propylene. Cardano works correctly here.",
    A: 1,
    B: -0.971426613722,
    C: 2.857338622910670e-2,
    D: -2.356986025368972e-11,
    expectedFM: 0.9410637546022087,
    expectedExperimental: 0.9410637561882021,
    cardanoFails: false,
    paperErrorFM: 1.685e-7,
  },
  {
    id: "V",
    label: "V — reduced molar volume",
    description: "Patel–Teja EoS, propylene at 95.4 K, 1.22×10⁻² Pa. Cardano FAILS.",
    A: 1,
    B: -1.212284923269059,
    C: 4.121478037063378e10,
    D: -4.242705529596227e10,
    expectedFM: 1.062627261021974,
    expectedExperimental: 1.062627259231100,
    expectedCardano: 1.159657862186432e2,
    cardanoFails: true,
    paperErrorFM: 1.685e-7,
    paperErrorCardano: 1.081e4,
  },
];

// FM tolerance: paper-grade fidelity. Allow some slack vs. paper's reported error.
export const FM_TOLERANCE_PCT = 1e-5;
// Cardano in failing cases must exceed this error %
export const CARDANO_FAIL_THRESHOLD_PCT = 1e3;

// Pick the physically meaningful root: the one closest to the published expected value.
function pickClosestRealRoot(roots: Complex[], target: number): { value: number; isReal: boolean } {
  let best = roots[0];
  let bestDist = Infinity;
  for (const r of roots) {
    // Treat near-real as real; physical root must be real.
    const realPart = r.re;
    const imagPenalty = Math.abs(r.im) > 1e-6 * Math.max(1, Math.abs(realPart)) ? Infinity : 0;
    const d = Math.abs(realPart - target) + imagPenalty;
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return { value: best.re, isReal: Math.abs(best.im) < 1e-6 * Math.max(1, Math.abs(best.re)) };
}

function relErrorPct(value: number, ref: number): number {
  if (ref === 0) return value === 0 ? 0 : Infinity;
  return Math.abs((value - ref) / ref) * 100;
}

export interface MethodResult {
  method: "Fernández Molina" | "Cardano" | "Newton-Raphson";
  picked: number;
  isReal: boolean;
  errorVsPaperFM_pct: number;
  errorVsExperimental_pct: number;
  iterations: number;
  notes?: string;
  pass: boolean;
  failExpected: boolean; // true when this method is expected to fail on this case (Cardano on Z, V)
  raw: SolveResult;
}

export interface CaseResult {
  case: PatelTejaCase;
  methods: MethodResult[];
  passOverall: boolean; // whether FM passed the tolerance
}

export interface BenchmarkReport {
  cases: CaseResult[];
  overallPass: boolean;
  generatedAt: string;
  precision: "IEEE-754 double";
}

export function runPatelTejaValidation(): BenchmarkReport {
  const cases: CaseResult[] = PATEL_TEJA_CASES.map((tc) => {
    const fm = solveFernandezMolina(tc.A, tc.B, tc.C, tc.D);
    const cd = solveCardano(tc.A, tc.B, tc.C, tc.D);
    const nw = solveNewton(tc.A, tc.B, tc.C, tc.D);

    const buildMethod = (
      name: MethodResult["method"],
      r: SolveResult,
      failExpected: boolean,
    ): MethodResult => {
      const picked = pickClosestRealRoot(r.roots, tc.expectedFM);
      const errFM = relErrorPct(picked.value, tc.expectedFM);
      const errExp = relErrorPct(picked.value, tc.expectedExperimental);
      let pass: boolean;
      if (name === "Fernández Molina") {
        pass = errFM < FM_TOLERANCE_PCT;
      } else if (failExpected) {
        // Cardano on Z, V: pass means it indeed fails (error > threshold)
        pass = errFM > CARDANO_FAIL_THRESHOLD_PCT;
      } else {
        // Cardano on ρ, and Newton everywhere: should also be near the answer
        pass = errFM < 1e-3; // looser tolerance: Newton converges, but not paper-grade
      }
      return {
        method: name,
        picked: picked.value,
        isReal: picked.isReal,
        errorVsPaperFM_pct: errFM,
        errorVsExperimental_pct: errExp,
        iterations: r.iterations,
        notes: r.notes,
        pass,
        failExpected,
        raw: r,
      };
    };

    const methods: MethodResult[] = [
      buildMethod("Fernández Molina", fm, false),
      buildMethod("Cardano", cd, tc.cardanoFails),
      buildMethod("Newton-Raphson", nw, false),
    ];

    return {
      case: tc,
      methods,
      passOverall: methods[0].pass,
    };
  });

  return {
    cases,
    overallPass: cases.every((c) => c.passOverall),
    generatedAt: new Date().toISOString(),
    precision: "IEEE-754 double",
  };
}

// CLI entry: `npx tsx src/lib/patelTejaBenchmark.ts`
// (also runnable from any node with the right loader)
declare const require: { main?: unknown } | undefined;
declare const module: { exports?: unknown } | undefined;
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const report = runPatelTejaValidation();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log(`\nOverall: ${report.overallPass ? "PASS ✅" : "FAIL ❌"}`);
}
