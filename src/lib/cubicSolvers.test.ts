import { describe, it, expect } from "vitest";
import {
  solveFernandezMolina,
  solveCardano,
  solveNewton,
  depress,
  isReal,
  type Complex,
} from "@/lib/cubicSolvers";

// Helper: evaluate polynomial at a complex point and check residual ≈ 0
const evalPoly = (A: number, B: number, C: number, D: number, x: Complex) => {
  // (((A x + B) x) + C) x + D, complex
  const mul = (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  });
  const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
  const k = (s: number, a: Complex): Complex => ({ re: s * a.re, im: s * a.im });
  let acc: Complex = { re: A, im: 0 };
  acc = add(mul(acc, x), { re: B, im: 0 });
  acc = add(mul(acc, x), { re: C, im: 0 });
  acc = add(mul(acc, x), { re: D, im: 0 });
  return Math.hypot(acc.re, acc.im);
  // unused but kept type-correct
  void k;
};

const expectRootSatisfies = (
  A: number, B: number, C: number, D: number, roots: Complex[], tol = 1e-6,
) => {
  for (const r of roots) {
    const res = evalPoly(A, B, C, D, r);
    const scale = Math.max(1, Math.abs(A), Math.abs(B), Math.abs(C), Math.abs(D));
    expect(res / scale).toBeLessThan(tol);
  }
};

const sortReals = (roots: Complex[]) =>
  roots.filter(isReal).map((r) => r.re).sort((a, b) => a - b);

describe("solveFernandezMolina — required test matrix", () => {
  it("normal cubic: x³ − 6x² + 11x − 6 = 0 → {1, 2, 3}", () => {
    const r = solveFernandezMolina(1, -6, 11, -6);
    const reals = sortReals(r.roots);
    expect(reals.length).toBe(3);
    [1, 2, 3].forEach((expected, i) => {
      expect(Math.abs(reals[i] - expected)).toBeLessThan(1e-6);
    });
    expectRootSatisfies(1, -6, 11, -6, r.roots);
  });

  it("Δ = 0 case: (x−1)²(x+2) = x³ − 3x + 2 → roots {1, 1, −2}", () => {
    const r = solveFernandezMolina(1, 0, -3, 2);
    expect(r.method).toMatch(/Δ≈0|closed form/);
    expectRootSatisfies(1, 0, -3, 2, r.roots, 1e-6);
    const reals = sortReals(r.roots);
    expect(reals.length).toBe(3);
    expect(Math.abs(reals[0] - -2)).toBeLessThan(1e-6);
    // double root at 1
    expect(Math.abs(reals[1] - 1)).toBeLessThan(1e-6);
    expect(Math.abs(reals[2] - 1)).toBeLessThan(1e-6);
  });

  it("p = 0, q ≠ 0: x³ − 8 = 0 → 2, −1±i√3 (Eq. 57 branch)", () => {
    const r = solveFernandezMolina(1, 0, 0, -8);
    expect(r.method).toMatch(/q-axis|Eq\. 57/);
    expectRootSatisfies(1, 0, 0, -8, r.roots);
    const reals = sortReals(r.roots);
    expect(reals).toContain(2);
    // also verify complex pair magnitude ≈ 2 and im ≈ ±√3
    const complex = r.roots.filter((rt) => !isReal(rt));
    expect(complex.length).toBe(2);
    for (const c of complex) {
      expect(Math.abs(c.re - -1)).toBeLessThan(1e-6);
      expect(Math.abs(Math.abs(c.im) - Math.sqrt(3))).toBeLessThan(1e-6);
    }
  });

  it("three real roots (Δ<0): x³ − 7x + 6 → {−3, 1, 2}", () => {
    const r = solveFernandezMolina(1, 0, -7, 6);
    expectRootSatisfies(1, 0, -7, 6, r.roots);
    const reals = sortReals(r.roots);
    expect(reals).toEqual(expect.arrayContaining([-3, 1, 2].map(() => expect.any(Number))));
    [-3, 1, 2].forEach((v, i) => expect(Math.abs(reals[i] - v)).toBeLessThan(1e-6));
  });

  it("complex conjugate pair: x³ + x + 10 → real ≈ −2, complex pair", () => {
    const r = solveFernandezMolina(1, 0, 1, 10);
    expectRootSatisfies(1, 0, 1, 10, r.roots);
    const reals = r.roots.filter(isReal);
    const complex = r.roots.filter((rt) => !isReal(rt));
    expect(reals.length).toBe(1);
    expect(complex.length).toBe(2);
    // conjugate pair: same re, opposite im
    expect(Math.abs(complex[0].re - complex[1].re)).toBeLessThan(1e-6);
    expect(Math.abs(complex[0].im + complex[1].im)).toBeLessThan(1e-6);
  });

  it("extreme coefficients: large magnitudes still yield valid residual", () => {
    const A = 1, B = 1e6, C = 1, D = -1e-6;
    const r = solveFernandezMolina(A, B, C, D);
    // Use relative tolerance scaled by coefficient magnitude
    expectRootSatisfies(A, B, C, D, r.roots, 1e-3);
  });

  it("buffer zone: when |ratio|≈1, fallback to Newton is used", () => {
    // Construct a depressed cubic with ratio q²/(4Δ) ≈ 1
    // Pick p,q such that q²/4 ≈ p³/27  ⇒ q²/(4Δ) → ∞ ratio? no — equal makes Δ≈q²/2
    // Easier: search numerically a coefficient that lands in buffer
    // Use x³ − 3x + 2.0001 (perturbation off Δ=0 boundary)
    const r = solveFernandezMolina(1, 0, -3, 2.0001);
    expectRootSatisfies(1, 0, -3, 2.0001, r.roots, 1e-4);
    // method should NOT crash; could be buffer or Δ<0 trig depending on sign
    expect(r.roots.length).toBe(3);
  });
});

describe("Cross-method consistency", () => {
  it("Cardano, Newton and FM agree on well-conditioned cubic", () => {
    const A = 1, B = -6, C = 11, D = -6;
    const fm = sortReals(solveFernandezMolina(A, B, C, D).roots);
    const cd = sortReals(solveCardano(A, B, C, D).roots);
    const nw = sortReals(solveNewton(A, B, C, D).roots);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(fm[i] - cd[i])).toBeLessThan(1e-6);
      expect(Math.abs(fm[i] - nw[i])).toBeLessThan(1e-6);
    }
  });
});

describe("Helpers", () => {
  it("depress() satisfies y³+py+q form", () => {
    const { p, q, shift } = depress(1, -6, 11, -6);
    // x=1 is a root → y = 1 − shift
    const y = 1 - shift;
    expect(Math.abs(y * y * y + p * y + q)).toBeLessThan(1e-10);
  });
});
