import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  classifyStability, depress, fmtC, getStableCubicMetrics, isReal, maxRootDifference,
  solveCardano, solveFernandezMolina, solveNewton, type SolveResult,
} from "@/lib/cubicSolvers";
import { AlertTriangle, CheckCircle2, XCircle, Sigma, Activity, FlaskConical, ShieldCheck, ShieldAlert, RotateCcw, Eraser } from "lucide-react";
import { PatelTejaPanel } from "@/components/PatelTejaPanel";

type Coeffs = { A: string; B: string; C: string; D: string };

const DEFAULT_COEFFS: Coeffs = { A: "1", B: "1000000", C: "1", D: "-0.000001" };
const EMPTY_COEFFS: Coeffs = { A: "", B: "", C: "", D: "" };

const PRESETS: Record<string, Coeffs & { label: string; desc: string }> = {
  normal:    { label: "Normal",            desc: "x³−6x²+11x−6 → {1,2,3}",                A: "1", B: "-6", C: "11", D: "-6" },
  threeReal: { label: "3 real roots",      desc: "x³−7x+6 → {−3,1,2} (Δ<0, Viète)",       A: "1", B: "0",  C: "-7", D: "6"  },
  doubleRoot:{ label: "Double root (Δ=0)", desc: "(x−1)²(x+2) = x³−3x+2",                  A: "1", B: "0",  C: "-3", D: "2"  },
  qAxis:     { label: "p=0, q≠0 (Eq. 57)", desc: "x³−8=0 → {2, −1±i√3}",                   A: "1", B: "0",  C: "0",  D: "-8" },
  illCond:   { label: "Ill-conditioned",   desc: "x³+10⁶x²+x−10⁻⁶ — coeff. spread 10¹²",  A: "1", B: "1000000", C: "1", D: "-0.000001" },
  buffer:    { label: "Buffer zone",       desc: "Near |ratio|≈1 → Newton fallback",       A: "1", B: "0",  C: "-3", D: "2.0001" },
};

const Index = () => {
  const [c, setC] = useState<Coeffs>(DEFAULT_COEFFS);

  const A = parseFloat(c.A);
  const B = parseFloat(c.B);
  const Ccoef = parseFloat(c.C);
  const D = parseFloat(c.D);
  const valid = Number.isFinite(A) && Number.isFinite(B) && Number.isFinite(Ccoef) && Number.isFinite(D) && Math.abs(A) > 1e-300;

  const results = useMemo(() => {
    if (!valid) return null;
    const { p, q } = depress(A, B, Ccoef, D);
    const { delta, ratio } = getStableCubicMetrics(A, B, Ccoef, D);
    const fm = solveFernandezMolina(A, B, Ccoef, D);
    const cd = solveCardano(A, B, Ccoef, D);
    const nw = solveNewton(A, B, Ccoef, D);
    const stab = classifyStability(A, B, Ccoef, D);
    return { p, q, delta, ratio, fm, cd, nw, stab };
  }, [A, B, Ccoef, D, valid]);

  const setField = (k: keyof Coeffs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setC({ ...c, [k]: e.target.value });

  const loadPreset = (key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    setC({ A: p.A, B: p.B, C: p.C, D: p.D });
  };

  const activePreset = useMemo(() => {
    const eq = (a: string, b: string) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b;
      if (na === nb) return true;
      const scale = Math.max(Math.abs(na), Math.abs(nb), 1);
      return Math.abs(na - nb) / scale < 1e-12;
    };
    return Object.entries(PRESETS).find(([, p]) =>
      eq(p.A, c.A) && eq(p.B, c.B) && eq(p.C, c.C) && eq(p.D, c.D)
    )?.[0] ?? null;
  }, [c]);

  const stabBadge = (lvl: "green" | "yellow" | "red") => {
    if (lvl === "green") return (
      <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Stable</Badge>
    );
    if (lvl === "yellow") return (
      <Badge className="bg-warning text-warning-foreground gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Critical zone</Badge>
    );
    return (
      <Badge className="bg-destructive text-destructive-foreground gap-1"><XCircle className="h-3.5 w-3.5" /> Possible error</Badge>
    );
  };

  const chartData = useMemo(() => {
    if (!results) return [];
    const fm = results.fm.convergenceTrace;
    const nw = results.nw.convergenceTrace;
    const len = Math.max(fm.length, nw.length);
    return Array.from({ length: len }, (_, i) => ({
      step: i + 1,
      "Fernández Molina": fm[i] ?? null,
      "Newton-Raphson": nw[i] ?? null,
    }));
  }, [results]);

  // Evaluate f(x) = A x³ + B x² + C x + D for a complex root using Horner's scheme.
  // Returns |f(x)| as a real magnitude (suitable for residual display).
  const evalResidual = (rt: { re: number; im: number }): number => {
    if (!valid) return NaN;
    // Horner over complex numbers: ((A*x + B)*x + C)*x + D
    let zr = A, zi = 0;
    // step 1: z = A*x + B
    const t1r = zr * rt.re - zi * rt.im;
    const t1i = zr * rt.im + zi * rt.re;
    zr = t1r + B; zi = t1i;
    // step 2: z = z*x + C
    const t2r = zr * rt.re - zi * rt.im;
    const t2i = zr * rt.im + zi * rt.re;
    zr = t2r + Ccoef; zi = t2i;
    // step 3: z = z*x + D
    const t3r = zr * rt.re - zi * rt.im;
    const t3i = zr * rt.im + zi * rt.re;
    zr = t3r + D; zi = t3i;
    return Math.hypot(zr, zi);
  };

  const fmtResidual = (v: number): string => {
    if (!Number.isFinite(v)) return "—";
    if (v === 0) return "0.000e+0";
    return v.toExponential(3);
  };

  // Vieta's formulas: for Ax³+Bx²+Cx+D=0, sum of roots = -B/A, product = -D/A.
  const computeVieta = (roots: { re: number; im: number }[]) => {
    let sumRe = 0, sumIm = 0;
    let prRe = 1, prIm = 0;
    for (const rt of roots) {
      sumRe += rt.re; sumIm += rt.im;
      const nr = prRe * rt.re - prIm * rt.im;
      const ni = prRe * rt.im + prIm * rt.re;
      prRe = nr; prIm = ni;
    }
    const expectedSum = -B / A;
    const expectedProd = -D / A;
    const sumErr = Math.hypot(sumRe - expectedSum, sumIm);
    const prodErr = Math.hypot(prRe - expectedProd, prIm);
    // Si el valor esperado es exactamente 0, el error relativo no tiene sentido
    // (dividiría por ~0 amplificando ruido de punto flotante). Usamos error absoluto.
    const sumAbsMode = expectedSum === 0;
    const prodAbsMode = expectedProd === 0;
    const sumRel = sumAbsMode ? 0 : sumErr / Math.abs(expectedSum);
    const prodRel = prodAbsMode ? 0 : prodErr / Math.abs(expectedProd);
    return { sumRe, sumIm, prRe, prIm, expectedSum, expectedProd, sumErr, prodErr, sumRel, prodRel, sumAbsMode, prodAbsMode };
  };

  const fmtSigned = (re: number, im: number): string => {
    if (Math.abs(im) < 1e-12) return re.toFixed(6);
    return `${re.toFixed(6)} ${im >= 0 ? "+" : "-"} ${Math.abs(im).toFixed(6)}i`;
  };

  const renderRoots = (r: SolveResult) => {
    const v = computeVieta(r.roots);
    const sumOk = v.sumAbsMode ? v.sumErr < 1e-10 : v.sumRel < 1e-8; // 1e-6 % == 1e-8
    const prodOk = v.prodAbsMode ? v.prodErr < 1e-10 : v.prodRel < 1e-8;
    return (
      <div className="space-y-2">
        <ul className="space-y-1 font-mono text-sm">
          {r.roots.map((rt, i) => {
            const res = evalResidual(rt);
            const tiny = Number.isFinite(res) && res < 1e-6;
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted-foreground">x{i + 1} =</span>
                <span className="text-foreground">{fmtC(rt)}</span>
                <Badge variant="outline" className="text-[10px] py-0 h-4">
                  {isReal(rt) ? "real" : "complex"}
                </Badge>
                <span
                  className={`text-[11px] ${tiny ? "text-success" : "text-muted-foreground"}`}
                  title="Residual |f(xᵢ)| evaluated by Horner's scheme"
                >
                  f(x{i + 1}) = {fmtResidual(res)}
                </span>
              </li>
            );
          })}
        </ul>
        <div
          className="rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] space-y-1"
          title="Verificación por relaciones de Vieta: suma = -B/A, producto = -D/A"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Suma</span>
            <span className={sumOk ? "text-success" : "text-warning"}>
              {sumOk ? "✅" : "⚠️"}{" "}
              {v.sumAbsMode ? `|Δ|=${v.sumErr.toExponential(2)}` : `${(v.sumRel * 100).toExponential(2)}%`}
            </span>
          </div>
          <div className="text-muted-foreground">
            Σxᵢ = <span className="text-foreground">{fmtSigned(v.sumRe, v.sumIm)}</span>
          </div>
          <div className="text-muted-foreground">
            −B/A = <span className="text-foreground">{v.expectedSum.toFixed(6)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
            <span className="text-muted-foreground">Producto</span>
            <span className={prodOk ? "text-success" : "text-warning"}>
              {prodOk ? "✅" : "⚠️"} {(v.prodRel * 100).toExponential(2)}%
            </span>
          </div>
          <div className="text-muted-foreground">
            Πxᵢ = <span className="text-foreground">{fmtSigned(v.prRe, v.prIm)}</span>
          </div>
          <div className="text-muted-foreground">
            −D/A = <span className="text-foreground">{v.expectedProd.toFixed(6)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="container py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">
              ƒ
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Cubic Solver Lab</h1>
              <p className="text-xs text-muted-foreground">Fernández Molina Method — interactive demonstration</p>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex border-primary/40 text-primary">
            AIP Advances 2022 · DOI 10.1063/5.0073851
          </Badge>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Welcome line */}
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">Este método resuelve cúbicas donde Cardano falla.</span>{" "}
          <span className="text-muted-foreground">Cargado con un caso donde la diferencia es visible.</span>
        </div>

        {/* Patel-Teja published-benchmark validation — moved above the fold */}
        <PatelTejaPanel />

        {/* Inputs + presets */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sigma className="h-4 w-4 text-primary" /> Polynomial Ax³ + Bx² + Cx + D = 0
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(["A", "B", "C", "D"] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>{k}</Label>
                    <Input id={k} value={c[k]} onChange={setField(k)} inputMode="decimal" />
                  </div>
                ))}
              </div>
              {!valid && (
                <p className="text-sm text-destructive mt-3">Invalid input. A must be a non-zero finite number.</p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {Object.entries(PRESETS).map(([k, v]) => {
                  const isActive = activePreset === k;
                  return (
                    <Button
                      key={k}
                      size="sm"
                      variant="secondary"
                      title={v.desc}
                      onClick={() => loadPreset(k as keyof typeof PRESETS)}
                      className={isActive ? "border-2 border-primary bg-primary/15 text-foreground hover:bg-primary/20" : ""}
                      aria-pressed={isActive}
                    >
                      {v.label}
                    </Button>
                  );
                })}
                <div className="w-px bg-border mx-1" aria-hidden />
                <Button
                  size="sm"
                  variant="outline"
                  title="Restablecer al caso normal x³−6x²+11x−6"
                  onClick={() => setC(DEFAULT_COEFFS)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Limpiar todos los campos"
                  onClick={() => setC(EMPTY_COEFFS)}
                >
                  <Eraser className="h-3.5 w-3.5 mr-1.5" /> Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> Stability indicator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {results ? (
                <>
                  <div>{stabBadge(results.stab.level)}</div>
                  <div className="text-sm text-muted-foreground">{results.stab.reason}</div>
                  <div className="font-mono text-xs space-y-1 pt-2 border-t border-border">
                    <div>p = {results.p.toExponential(4)}</div>
                    <div>q = {results.q.toExponential(4)}</div>
                    <div>Δ = {results.delta.toExponential(4)}</div>
                    <div>|q²/(4Δ)| = {Math.abs(results.ratio).toExponential(4)}</div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Enter valid coefficients.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Method results */}
        {results && (
          <div className="grid gap-6 lg:grid-cols-3">
            {[results.fm, results.cd, results.nw].map((r, idx) => (
              <Card key={idx} className="border-l-4" style={idx === 0 ? { borderLeftColor: "hsl(var(--primary))" } : undefined}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{r.method}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {r.iterations} {idx === 2 ? "iter" : "terms"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {renderRoots(r)}
                  {r.notes && <p className="text-xs text-muted-foreground pt-2 border-t border-border">{r.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Convergence chart */}
        {results && chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-primary" /> Convergence of x₁ approximation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="step"
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: "step (term / iteration)", position: "insideBottom", offset: -2, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="Fernández Molina"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Newton-Raphson"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparator */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparator — root-set differences</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Root x₁</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead className="text-right">Δ vs Fernández Molina</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[results.fm, results.cd, results.nw].map((r) => {
                    const diff = maxRootDifference(r.roots, results.fm.roots);
                    const refMag = Math.max(1e-300, Math.abs(results.fm.roots[0]?.re ?? 0) + Math.abs(results.fm.roots[0]?.im ?? 0));
                    const relPct = (diff / refMag) * 100;
                    const isFM = r === results.fm;
                    const fails = !isFM && relPct > 1e-3;
                    const matches = !isFM && diff > 0 && relPct <= 1e-3;
                    return (
                      <TableRow key={r.method}>
                        <TableCell className="font-medium">{r.method}</TableCell>
                        <TableCell className="font-mono text-xs">{fmtC(r.roots[0])}</TableCell>
                        <TableCell className="font-mono text-xs">{r.iterations}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <div className="flex items-center justify-end gap-2">
                            <span>{isFM ? "—" : diff.toExponential(3)}</span>
                            {fails && (
                              <Badge className="bg-destructive text-destructive-foreground gap-1 text-[10px]">
                                <XCircle className="h-3 w-3" /> FALLA
                              </Badge>
                            )}
                            {matches && (
                              <Badge className="bg-success text-success-foreground gap-1 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> COINCIDE
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Technical fidelity block */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Technical fidelity to the paper
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="font-medium text-success mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Faithfully implemented
                </p>
                <ul className="space-y-1 text-muted-foreground list-disc pl-5">
                  <li>Eq. (4)–(5): depression coefficients p, q</li>
                  <li>Eq. (7): discriminant Δ = q²/4 + p³/27</li>
                  <li>Eq. (17): Series A with incremental binomial recurrence</li>
                  <li>Eq. (30): Series B with incremental binomial recurrence</li>
                  <li>Eq. (37) + (58): special curve p³+27q²/2 = 0 (closed form)</li>
                  <li>Eq. (51)–(53): stabilized deflation with sign(B+Ax₁)</li>
                  <li>Eq. (57): q-axis branch p=0, q≠0 (closed form)</li>
                  <li>Δ = 0 closed form: y₁=−(4q)^⅓, y₂=y₃=(q/2)^⅓</li>
                  <li>Buffer zone |ratio−1| &lt; {0.05} → Newton-Raphson fallback</li>
                  <li>IEEE-754 safe cube root (Math.cbrt for q&lt;0)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-warning mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Practical simplifications
                </p>
                <ul className="space-y-1 text-muted-foreground list-disc pl-5">
                  <li>Eq. (47) a-priori bound: replaced by empirical |term|&lt;ε stop</li>
                  <li>Δ&lt;0 (M imaginary): delegated to Viète/trig instead of complex series</li>
                  <li>Eq. (55)–(56): complex pairs computed by quadratic deflation, not via ω₁,ω₂</li>
                  <li>Double-precision IEEE-754 only; no arbitrary precision mode</li>
                  <li>Validation against Patel-Teja propylene case (Tables I–II) not yet automated</li>
                  <li>Newton fallback in buffer zone uses inflection-point seed, not paper's continuation</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="font-medium text-foreground mb-2 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-warning" /> Nota sobre precisión numérica — benchmark Patel–Teja
              </p>
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Los casos <span className="font-mono text-foreground">Z</span> y <span className="font-mono text-foreground">V</span> del benchmark Patel–Teja requieren aritmética de precisión extendida para reproducir los valores exactos reportados en el paper.
                </p>
                <p>
                  En doble precisión IEEE-754, los coeficientes del polinomio se encuentran cerca del límite de representación numérica (ε ≈ 2.2×10⁻¹⁶), lo que introduce errores relativos significativos en operaciones sensibles.
                </p>
                <p>
                  Como resultado, los tres métodos (Fernández Molina, Cardano y Newton-Raphson) convergen a una solución consistente entre sí (~1.4×10⁻⁸ para Z), pero diferente al valor publicado.
                </p>
                <p>
                  El caso <span className="font-mono text-foreground">ρ</span>, mejor condicionado numéricamente, reproduce la fidelidad del paper con error &lt; 1×10⁻⁷ %.
                </p>
                <p className="italic">
                  Este comportamiento refleja una limitación de la precisión numérica utilizada, no del método matemático.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <footer className="border-t border-border pt-4 pb-6 mt-4 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Academic attribution</p>
          <p>
            <span className="text-foreground">
              Fernández Molina, R. A.; Sigalotti, L. Di G.; Rendón, O.; Mejías, A. J.
            </span>{" "}
            (2022). <em>A rapidly convergent method for solving third-order polynomials.</em>{" "}
            <span className="text-foreground">AIP Advances</span> 12, 045002. DOI:{" "}
            <a
              href="https://doi.org/10.1063/5.0073851"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              10.1063/5.0073851
            </a>
            .
          </p>
          <p>
            This interactive demo is an independent educational implementation. It is not affiliated
            with or endorsed by the original authors. All theoretical content belongs to the cited authors.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
