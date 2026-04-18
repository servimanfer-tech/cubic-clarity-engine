import { describe, it, expect } from "vitest";
import {
  solveFernandezMolina,
  solveCardano,
  solveNewton,
  depress,
  isReal,
  type Complex,
} from "@/lib/cubicSolvers";

// Polynomial residual at complex point (Horner)
function residual(A: number, B: number, C: number, D: number, x: Complex): number {
  const mul = (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  });
  const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
  let acc: Complex = { re: A, im: 0 };
  acc = add(mul(acc, x), { re: B, im: 0 });
  acc = add(mul(acc, x), { re: C, im: 0 });
  acc = add(mul(acc, x), { re: D, im: 0 });
  return Math.hypot(acc.re, acc.im);
}

const expectRootSatisfies = (
  A: number, B: number, C: number, D: number, roots: Complex[], tol = 1e-6,
) => {
  const scale = Math.max(1, Math.abs(A), Math.abs(B), Math.abs(C), Math.abs(D));
  for (const r of roots) {
    expect(residual(A, B, C, D, r) / scale).toBeLessThan(tol);
  }
};

// Wrap isReal so Array.filter doesn't pass index as `tol`
const realOnly = (roots: Complex[]) => roots.filter((r) => isReal(r));
const complexOnly = (roots: Complex[]) => roots.filter((r) => !isReal(r));

const sortReals = (roots: Complex[]) =>
  realOnly(roots).map((r) => r.re).sort((a, b) => a - b);

describe("solveFernandezMolina — required test matrix", () => {
  it("normal cubic: x³ − 6x² + 11x − 6 = 0 → {1, 2, 3}", () => {
    const r = solveFernandezMolina(1, -6, 11, -6);
    expectRootSatisfies(1, -6, 11, -6, r.roots);
    const reals = sortReals(r.roots);
    expect(reals.length).toBe(3);
    [1, 2, 3].forEach((expected, i) => {
      expect(Math.abs(reals[i] - expected)).toBeLessThan(1e-6);
    });
  });

  it("Δ = 0 case: (x−1)²(x+2) = x³ − 3x + 2 → roots {1, 1, −2}", () => {
    const r = solveFernandezMolina(1, 0, -3, 2);
    expectRootSatisfies(1, 0, -3, 2, r.roots, 1e-6);
    const reals = sortReals(r.roots);
    expect(reals.length).toBe(3);
    expect(Math.abs(reals[0] - -2)).toBeLessThan(1e-6);
    expect(Math.abs(reals[1] - 1)).toBeLessThan(1e-6);
    expect(Math.abs(reals[2] - 1)).toBeLessThan(1e-6);
  });

  it("p = 0, q ≠ 0: x³ − 8 = 0 → 2, −1±i√3 (Eq. 57 branch)", () => {
    const r = solveFernandezMolina(1, 0, 0, -8);
    expect(r.method).toMatch(/q-axis|Eq\. 57/);
    expectRootSatisfies(1, 0, 0, -8, r.roots);
    const reals = sortReals(r.roots);
    expect(reals.length).toBe(1);
    expect(Math.abs(reals[0] - 2)).toBeLessThan(1e-6);
    const cplx = complexOnly(r.roots);
    expect(cplx.length).toBe(2);
    for (const c of cplx) {
      expect(Math.abs(c.re - -1)).toBeLessThan(1e-6);
      expect(Math.abs(Math.abs(c.im) - Math.sqrt(3))).toBeLessThan(1e-6);
    }
  });

  it("three real roots (Δ<0): x³ − 7x + 6 → {−3, 1, 2}", () => {
    const r = solveFernandezMolina(1, 0, -7, 6);
    expectRootSatisfies(1, 0, -7, 6, r.roots);
    const reals = sortReals(r.roots);
    expect(reals.length).toBe(3);
    [-3, 1, 2].forEach((v, i) => expect(Math.abs(reals[i] - v)).toBeLessThan(1e-6));
  });

  it("complex conjugate pair: x³ + x + 10 → 1 real + complex pair", () => {
    const r = solveFernandezMolina(1, 0, 1, 10);
    expectRootSatisfies(1, 0, 1, 10, r.roots);
    const reals = realOnly(r.roots);
    const cplx = complexOnly(r.roots);
    expect(reals.length).toBe(1);
    expect(cplx.length).toBe(2);
    expect(Math.abs(cplx[0].re - cplx[1].re)).toBeLessThan(1e-6);
    expect(Math.abs(cplx[0].im + cplx[1].im)).toBeLessThan(1e-6);
  });

  it("extreme coefficients: large magnitude spread retains valid residual", () => {
    const A = 1, B = 1e6, C = 1, D = -1e-6;
    const r = solveFernandezMolina(A, B, C, D);
    expectRootSatisfies(A, B, C, D, r.roots, 1e-3);
  });

  it("buffer zone: |ratio|≈1 routes to Newton fallback", () => {
    // Construct (p,q) so q²/(4Δ) ≈ 1
    // Pick p=-3, q=2.0001 → Δ = (2.0001²)/4 + (-3)³/27 = 1.0001 - 1 ≈ 0.0001
    // ratio = 2.0001²/(4·0.0001) ≈ 10000 → out of buffer; use parameters that target buffer
    // Instead: set p,q such that ratio≈1 ⇒ q²/4 ≈ Δ ⇒ p³/27 ≈ 0 ⇒ p≈0; degenerate.
    // Better: search numerically.
    let coeffs: [number, number, number, number] | null = null;
    for (let q = 0.5; q < 5; q += 0.01) {
      const p = -1.0; // fixed
      const delta = (q * q) / 4 + (p * p * p) / 27;
      if (delta <= 0) continue;
      const ratio = (q * q) / (4 * delta);
      if (Math.abs(ratio - 1) < 0.04) {
        // Convert to (A,B,C,D) with B=0 (depressed)
        coeffs = [1, 0, p, q];
        break;
      }
    }
    expect(coeffs).not.toBeNull();
    const [A, B, C, D] = coeffs!;
    const r = solveFernandezMolina(A, B, C, D);
    expect(r.method).toMatch(/BUFFER|Newton/);
    expectRootSatisfies(A, B, C, D, r.roots, 1e-4);
  });
});

describe("Cross-method consistency", () => {
  it("Cardano, Newton and FM agree on well-conditioned cubic (1,-6,11,-6)", () => {
    const A = 1, B = -6, C = 11, D = -6;
    const fm = sortReals(solveFernandezMolina(A, B, C, D).roots);
    const cd = sortReals(solveCardano(A, B, C, D).roots);
    const nw = sortReals(solveNewton(A, B, C, D).roots);
    expect(fm.length).toBe(3);
    expect(cd.length).toBe(3);
    expect(nw.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(fm[i] - cd[i])).toBeLessThan(1e-6);
      expect(Math.abs(fm[i] - nw[i])).toBeLessThan(1e-6);
    }
  });
});

describe("Helpers", () => {
  it("depress() satisfies y³+py+q=0 at y = x + shift", () => {
    // x = y - B/(3A) = y - shift  ⇒  y = x + shift
    const { p, q, shift } = depress(1, -6, 11, -6);
    const y = 1 + shift; // x=1 root
    expect(Math.abs(y * y * y + p * y + q)).toBeLessThan(1e-10);
  });
});
