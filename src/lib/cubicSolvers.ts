// Cubic equation solvers — Fernández Molina (series), Cardano, Newton-Raphson
// Educational/demo implementation: functional consistency over absolute precision.

export type Complex = { re: number; im: number };

export const fmtC = (c: Complex, digits = 6): string => {
  const r = Number(c.re.toFixed(digits));
  const i = Number(c.im.toFixed(digits));
  if (Math.abs(i) < 1e-10) return `${r}`;
  return `${r} ${i >= 0 ? "+" : "-"} ${Math.abs(i)}i`;
};

export const isReal = (c: Complex, tol?: number) => Math.abs(c.im) < (tol ?? 1e-8);

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
// Branches in execution order:
//   B1. (p≈0, q≈0)         → triple root y=0                          [closed form]
//   B2. p≈0, q≠0           → Eq. (57) on q-axis                       [closed form]
//   B3. Δ≈0, p,q ≠ 0       → y₁=−(4q)^{1/3}, y₂=y₃=(q/2)^{1/3}        [closed form]
//   B4. p³+27q²/2 ≈ 0      → Eq. (37)+(58) special curve              [closed form]
//   B5. Δ < 0              → trigonometric (Viète) — paper notes M is imaginary
//   B6. |ratio − 1| < δ    → BUFFER ZONE: Newton-Raphson refined fallback
//   B7. otherwise          → Series A or Series B (paper Eq. 17 / 30)
export const FM_BUFFER_DELTA = 0.05; // half-width of buffer around |ratio|=1
export const FM_TOL_P = 1e-12;
export const FM_TOL_Q = 1e-15;
export const FM_TOL_DELTA = 1e-14;
export const FM_TOL_CURVE = 1e-12;

export function solveFernandezMolina(
  A: number, B: number, C: number, D: number,
  epsilon = 1e-12,
  maxTerms = 200,
): SolveResult {
  const { p, q, delta, shift } = depress(A, B, C, D);
  const trace: number[] = [];

  const pAbs = Math.abs(p);
  const qAbs = Math.abs(q);
  const dAbs = Math.abs(delta);
  const curve = p * p * p + (27 * q * q) / 2;

  // ----- B1: triple root at y=0 (Eq. trivial)
  if (pAbs < FM_TOL_P && qAbs < FM_TOL_Q) {
    const r = -shift;
    return {
      method: "Fernández Molina (closed form: triple root)",
      roots: [{ re: r, im: 0 }, { re: r, im: 0 }, { re: r, im: 0 }],
      iterations: 0,
      convergenceTrace: [r],
      notes: "p≈0, q≈0 → y³=0",
    };
  }

  // ----- B2: p ≈ 0, q ≠ 0 (Eq. 57): y₁ = −q^{1/3}; y₂,₃ = (q^{1/3}/2)(1 ± i√3)
  if (pAbs < FM_TOL_P) {
    const cq = Math.sign(q) * Math.cbrt(qAbs); // real cube root of q
    const y1 = -cq;
    const re = cq / 2;
    const im = (Math.sqrt(3) / 2) * cq;
    return {
      method: "Fernández Molina (closed form: q-axis, Eq. 57)",
      roots: [
        { re: y1 - shift, im: 0 },
        { re: re - shift, im: im },
        { re: re - shift, im: -im },
      ],
      iterations: 0,
      convergenceTrace: [y1 - shift],
      notes: "p≈0 ⇒ y³+q=0 (Eq. 57)",
    };
  }

  // ----- B3: Δ ≈ 0, p,q ≠ 0  → y₁=−(4q)^{1/3}, y₂=y₃=(q/2)^{1/3}
  //  (note paper sign convention: y₂=y₃ shares sign of (q/2)^{1/3})
  if (dAbs < FM_TOL_DELTA) {
    const fourq = 4 * q;
    const y1 = -Math.sign(fourq) * Math.cbrt(Math.abs(fourq));
    const y23 = Math.sign(q / 2) * Math.cbrt(Math.abs(q / 2));
    return {
      method: "Fernández Molina (closed form: Δ≈0)",
      roots: [
        { re: y1 - shift, im: 0 },
        { re: y23 - shift, im: 0 },
        { re: y23 - shift, im: 0 },
      ],
      iterations: 0,
      convergenceTrace: [y1 - shift],
      notes: "Δ≈0 (double root)",
    };
  }

  // ----- B4: special curve p³ + 27q²/2 = 0  (Eq. 37 + 58)
  // y₁ = −(q/4)^{1/3}(1+√3);  y₂,₃ from Eq. (58)
  if (Math.abs(curve) / Math.max(1, pAbs ** 3, qAbs * qAbs) < FM_TOL_CURVE) {
    const qOver4 = q / 4;
    const c = Math.sign(qOver4) * Math.cbrt(Math.abs(qOver4));
    const y1 = -c * (1 + Math.sqrt(3));
    // Eq. (58): the other two via deflation (kept consistent with paper structure)
    const root1 = y1 - shift;
    const b1 = B + A * root1;
    const c1 = C + b1 * root1;
    const disc = b1 * b1 - 4 * A * c1;
    const roots: Complex[] = [{ re: root1, im: 0 }];
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
      method: "Fernández Molina (closed form: curve Eq. 37/58)",
      roots,
      iterations: 0,
      convergenceTrace: [root1],
      notes: "p³ + 27q²/2 ≈ 0",
    };
  }

  // ----- B5: Δ < 0  → trigonometric (Viète)
  if (delta < 0) {
    const cardano = solveCardano(A, B, C, D);
    return {
      ...cardano,
      method: "Fernández Molina (trigonometric branch, Δ<0)",
      iterations: 1,
      notes: "Δ<0: M is imaginary; trigonometric form used (Viète).",
    };
  }

  // ----- B6: BUFFER zone around |ratio| ≈ 1
  const ratio = (q * q) / (4 * delta);
  if (Math.abs(Math.abs(ratio) - 1) < FM_BUFFER_DELTA) {
    // Use Newton-Raphson and label it as buffer fallback
    const nw = solveNewton(A, B, C, D, epsilon, 200);
    return {
      ...nw,
      method: "Fernández Molina (BUFFER fallback: Newton, |ratio|≈1)",
      notes: `Buffer zone |ratio−1|<${FM_BUFFER_DELTA}: series convergence too slow, switched to Newton-Raphson.`,
    };
  }

  // ----- B7: Series A or Series B
  const useA = Math.abs(ratio) < 1;
  const z = useA ? (q * q) / (4 * delta) : (4 * delta) / (q * q);
  let S = 0;
  const partials: number[] = [];
  const prefactor = -Math.sign(4 * q) * Math.cbrt(Math.abs(4 * q));

  let x1 = 0;
  let terms = 0;
  // Incremental binomial recurrence: c_{i+1} = c_i · (1/3 − i)/(i+1)
  // For series A we sum over odd indices (2k+1); for B over even (2k).
  if (useA) {
    let cc = 1; // C(1/3, 0) = 1
    let kIdx = 0;
    const factor = Math.cbrt(z);
    for (let kAcc = 0; kAcc < maxTerms; kAcc++) {
      // Advance cc until idx === kIdx (target = 2k+1)
      while (kIdx < 2 * kAcc + 1) {
        cc *= (1 / 3 - kIdx) / (kIdx + 1);
        kIdx++;
      }
      const term = cc * Math.pow(z, kAcc);
      S += term;
      partials.push(prefactor * factor * S - shift);
      terms = kAcc + 1;
      if (Math.abs(term) < epsilon && kAcc > 2) break;
    }
    x1 = prefactor * factor * S;
  } else {
    let cc = 1;
    let kIdx = 0;
    for (let kAcc = 0; kAcc < maxTerms; kAcc++) {
      while (kIdx < 2 * kAcc) {
        cc *= (1 / 3 - kIdx) / (kIdx + 1);
        kIdx++;
      }
      const term = cc * Math.pow(z, kAcc);
      S += term;
      partials.push(prefactor * S - shift);
      terms = kAcc + 1;
      if (Math.abs(term) < epsilon && kAcc > 2) break;
    }
    x1 = prefactor * S;
  }

  const root1 = x1 - shift;
  trace.push(...partials);

  // Stabilized deflation Eq. (51)–(53)
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
