// Cubic equation solvers — Fernández Molina (series), Cardano, Newton-Raphson
// Educational/demo implementation: functional consistency over absolute precision.

export type Complex = { re: number; im: number };

export const fmtC = (c: Complex, digits = 6): string => {
  const r = Number(c.re.toFixed(digits));
  const i = Number(c.im.toFixed(digits));
  if (Math.abs(i) < 1e-10) return `${r}`;
  return `${r} ${i >= 0 ? "+" : "-"} ${Math.abs(i)}i`;
};

export const isReal = (c: Complex, tol = 1e-8) => Math.abs(c.im) < tol;

export interface SolveResult {
  method: string;
  roots: Complex[];
  iterations: number;          // terms (series) or iterations (Newton)
  convergenceTrace: number[];  // approximation of x1 per step
  notes?: string;
}

const cbrt = (x: number) => Math.cbrt(x);

// Depress general cubic Ax^3+Bx^2+Cx+D -> y^3+py+q=0 with x = y - B/(3A)
export function depress(A: number, B: number, C: number, D: number) {
  const p = (3 * A * C - B * B) / (3 * A * A);
  const q = (2 * B ** 3 - 9 * A * B * C + 27 * A * A * D) / (27 * A ** 3);
  const delta = (q * q) / 4 + (p * p * p) / 27;
  const shift = B / (3 * A);
  return { p, q, delta, shift };
}

// ---------- Cardano ----------
export function solveCardano(A: number, B: number, C: number, D: number): SolveResult {
  const { p, q, delta, shift } = depress(A, B, C, D);
  const trace: number[] = [];
  const roots: Complex[] = [];

  if (delta > 0) {
    const sq = Math.sqrt(delta);
    const u = cbrt(-q / 2 + sq);
    const v = cbrt(-q / 2 - sq);
    const y1 = u + v;
    const reY = -(u + v) / 2;
    const imY = (Math.sqrt(3) / 2) * (u - v);
    roots.push({ re: y1 - shift, im: 0 });
    roots.push({ re: reY - shift, im: imY });
    roots.push({ re: reY - shift, im: -imY });
    trace.push(y1 - shift);
  } else if (Math.abs(delta) < 1e-14) {
    const u = cbrt(-q / 2);
    roots.push({ re: 2 * u - shift, im: 0 });
    roots.push({ re: -u - shift, im: 0 });
    roots.push({ re: -u - shift, im: 0 });
    trace.push(2 * u - shift);
  } else {
    // 3 real roots — trigonometric form
    const r = Math.sqrt(-(p ** 3) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    for (let k = 0; k < 3; k++) {
      const y = m * Math.cos((phi + 2 * Math.PI * k) / 3);
      roots.push({ re: y - shift, im: 0 });
    }
    trace.push(roots[0].re);
  }

  return { method: "Cardano", roots, iterations: 1, convergenceTrace: trace };
}

// ---------- Newton-Raphson (finds one real root, deflates) ----------
export function solveNewton(
  A: number, B: number, C: number, D: number,
  tol = 1e-12, maxIter = 100,
): SolveResult {
  const f = (x: number) => ((A * x + B) * x + C) * x + D;
  const fp = (x: number) => (3 * A * x + 2 * B) * x + C;

  // Start from -B/(3A) (inflection point — robust seed)
  let x = -B / (3 * A);
  const trace: number[] = [];
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const fx = f(x);
    const fpx = fp(x);
    trace.push(x);
    if (Math.abs(fx) < tol) break;
    if (Math.abs(fpx) < 1e-18) {
      x += 1e-6;
      continue;
    }
    const next = x - fx / fpx;
    if (Math.abs(next - x) < tol) {
      x = next;
      trace.push(x);
      break;
    }
    x = next;
  }

  // Deflate: Ax^3+Bx^2+Cx+D = (x - x1)(A x^2 + b1 x + c1)
  const b1 = B + A * x;
  const c1 = C + b1 * x;
  // Solve A y^2 + b1 y + c1 = 0
  const disc = b1 * b1 - 4 * A * c1;
  const roots: Complex[] = [{ re: x, im: 0 }];
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    roots.push({ re: (-b1 + s) / (2 * A), im: 0 });
    roots.push({ re: (-b1 - s) / (2 * A), im: 0 });
  } else {
    const s = Math.sqrt(-disc);
    roots.push({ re: -b1 / (2 * A), im: s / (2 * A) });
    roots.push({ re: -b1 / (2 * A), im: -s / (2 * A) });
  }

  return {
    method: "Newton-Raphson",
    roots,
    iterations: iter + 1,
    convergenceTrace: trace,
  };
}

// ---------- Fernández Molina — series method ----------
export function solveFernandezMolina(
  A: number, B: number, C: number, D: number,
  epsilon = 1e-12,
  maxTerms = 200,
): SolveResult {
  const { p, q, delta, shift } = depress(A, B, C, D);
  const trace: number[] = [];

  if (Math.abs(q) < 1e-15) {
    const cardano = solveCardano(A, B, C, D);
    return { ...cardano, method: "Fernández Molina (closed form q≈0)", iterations: 1 };
  }

  if (delta < 0) {
    const cardano = solveCardano(A, B, C, D);
    return {
      ...cardano,
      method: "Fernández Molina (trig branch, Δ<0)",
      iterations: 1,
      notes: "Δ<0: closed-form trigonometric path used.",
    };
  }

  const ratio = (q * q) / (4 * delta);
  const useA = Math.abs(ratio) < 1;
  const z = useA ? (q * q) / (4 * delta) : (4 * delta) / (q * q);
  let S = 0;
  const partials: number[] = [];
  const prefactor = -Math.sign(4 * q) * Math.cbrt(Math.abs(4 * q));

  let terms = 0;
  if (useA) {
    const zPow = (k: number) => Math.pow(z, k);
    let kAcc = 0;
    const factor = Math.cbrt(z);
    while (kAcc < maxTerms) {
      let cc = 1;
      for (let i = 0; i < (2 * kAcc + 1); i++) cc *= (1 / 3 - i) / (i + 1);
      const term = cc * zPow(kAcc);
      S += term;
      const partial = prefactor * factor * S - shift;
      partials.push(partial);
      terms = kAcc + 1;
      if (Math.abs(term) < epsilon && kAcc > 2) break;
      kAcc += 1;
    }
    var x1 = prefactor * factor * S;
  } else {
    let kAcc = 0;
    while (kAcc < maxTerms) {
      let cc = 1;
      for (let i = 0; i < (2 * kAcc); i++) cc *= (1 / 3 - i) / (i + 1);
      const term = cc * Math.pow(z, kAcc);
      S += term;
      const partial = prefactor * S - shift;
      partials.push(partial);
      terms = kAcc + 1;
      if (Math.abs(term) < epsilon && kAcc > 2) break;
      kAcc += 1;
    }
    var x1 = prefactor * S;
  }

  const root1 = x1 - shift;
  trace.push(...partials);

  const R = B * B - 4 * A * C - 2 * A * B * root1 - 3 * A * A * root1 * root1;
  const roots: Complex[] = [{ re: root1, im: 0 }];
  if (R >= 0) {
    const sgn = Math.sign(B + A * root1) || 1;
    const Gamma = -0.5 * (B + A * root1 + sgn * Math.sqrt(R));
    if (Math.abs(Gamma) > 1e-18) {
      const x2 = Gamma / A;
      const x3 = (C + B * root1 + A * root1 * root1) / Gamma;
      roots.push({ re: x2, im: 0 });
      roots.push({ re: x3, im: 0 });
    } else {
      roots.push({ re: -(B + A * root1) / (2 * A), im: 0 });
      roots.push({ re: -(B + A * root1) / (2 * A), im: 0 });
    }
  } else {
    const b1 = B + A * root1;
    const c1 = C + b1 * root1;
    const disc = b1 * b1 - 4 * A * c1;
    const s = Math.sqrt(Math.abs(disc));
    roots.push({ re: -b1 / (2 * A), im: s / (2 * A) });
    roots.push({ re: -b1 / (2 * A), im: -s / (2 * A) });
  }

  return {
    method: useA ? "Fernández Molina (Series A)" : "Fernández Molina (Series B)",
    roots,
    iterations: terms,
    convergenceTrace: trace,
    notes: `ratio |q²/(4Δ)| = ${Math.abs((q * q) / (4 * delta)).toExponential(3)}`,
  };
}

export type Stability = "green" | "yellow" | "red";
export function classifyStability(A: number, B: number, C: number, D: number): {
  level: Stability; ratio: number; reason: string;
} {
  const { delta, q } = depress(A, B, C, D);
  if (!isFinite(delta) || Math.abs(delta) < 1e-18) {
    return { level: "yellow", ratio: NaN, reason: "Δ ≈ 0 (multiple roots / boundary)" };
  }
  const r = Math.abs((q * q) / (4 * delta));
  if (!isFinite(r)) return { level: "red", ratio: r, reason: "Non-finite ratio" };
  if (Math.abs(r - 1) < 0.05) return { level: "yellow", ratio: r, reason: "Near convergence boundary |r|≈1" };
  if (r < 0.7 || r > 1.5) return { level: "green", ratio: r, reason: "Series converges quickly" };
  return { level: "yellow", ratio: r, reason: "Slow convergence zone" };
}

export function rootDifference(a: Complex, b: Complex): number {
  return Math.hypot(a.re - b.re, a.im - b.im);
}

export function maxRootDifference(setA: Complex[], setB: Complex[]): number {
  const used = new Set<number>();
  let maxD = 0;
  for (const ra of setA) {
    let best = Infinity;
    let bestIdx = -1;
    for (let j = 0; j < setB.length; j++) {
      if (used.has(j)) continue;
      const d = rootDifference(ra, setB[j]);
      if (d < best) { best = d; bestIdx = j; }
    }
    if (bestIdx >= 0) used.add(bestIdx);
    if (best > maxD) maxD = best;
  }
  return maxD;
}
