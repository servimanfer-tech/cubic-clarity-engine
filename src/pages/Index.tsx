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
  classifyStability, depress, fmtC, isReal, maxRootDifference,
  solveCardano, solveFernandezMolina, solveNewton, type SolveResult,
} from "@/lib/cubicSolvers";
import { AlertTriangle, CheckCircle2, XCircle, Sigma, Activity, FlaskConical, ShieldCheck, ShieldAlert } from "lucide-react";

type Coeffs = { A: string; B: string; C: string; D: string };

const PRESETS: Record<string, Coeffs & { label: string; desc: string }> = {
  normal:    { label: "Normal",            desc: "x³−6x²+11x−6 → {1,2,3}",                A: "1", B: "-6", C: "11", D: "-6" },
  threeReal: { label: "3 real roots",      desc: "x³−7x+6 → {−3,1,2} (Δ<0, Viète)",       A: "1", B: "0",  C: "-7", D: "6"  },
  doubleRoot:{ label: "Double root (Δ=0)", desc: "(x−1)²(x+2) = x³−3x+2",                  A: "1", B: "0",  C: "-3", D: "2"  },
  qAxis:     { label: "p=0, q≠0 (Eq. 57)", desc: "x³−8=0 → {2, −1±i√3}",                   A: "1", B: "0",  C: "0",  D: "-8" },
  illCond:   { label: "Ill-conditioned",   desc: "x³+10⁶x²+x−10⁻⁶ — coeff. spread 10¹²",  A: "1", B: "1e6", C: "1", D: "-1e-6" },
  buffer:    { label: "Buffer zone",       desc: "Near |ratio|≈1 → Newton fallback",       A: "1", B: "0",  C: "-3", D: "2.0001" },
};

const Index = () => {
  const [c, setC] = useState<Coeffs>({ A: "1", B: "-6", C: "11", D: "-6" });

  const A = parseFloat(c.A);
  const B = parseFloat(c.B);
  const Ccoef = parseFloat(c.C);
  const D = parseFloat(c.D);
  const valid = Number.isFinite(A) && Number.isFinite(B) && Number.isFinite(Ccoef) && Number.isFinite(D) && Math.abs(A) > 1e-300;

  const results = useMemo(() => {
    if (!valid) return null;
    const { p, q, delta } = depress(A, B, Ccoef, D);
    const ratio = (q * q) / (4 * delta);
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

  const renderRoots = (r: SolveResult) => (
    <ul className="space-y-1 font-mono text-sm">
      {r.roots.map((rt, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground">x{i + 1} =</span>
          <span className="text-foreground">{fmtC(rt)}</span>
          <Badge variant="outline" className="text-[10px] py-0 h-4">
            {isReal(rt) ? "real" : "complex"}
          </Badge>
        </li>
      ))}
    </ul>
  );

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
                {Object.entries(PRESETS).map(([k, v]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="secondary"
                    title={v.desc}
                    onClick={() => loadPreset(k as keyof typeof PRESETS)}
                  >
                    {v.label}
                  </Button>
                ))}
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
                    return (
                      <TableRow key={r.method}>
                        <TableCell className="font-medium">{r.method}</TableCell>
                        <TableCell className="font-mono text-xs">{fmtC(r.roots[0])}</TableCell>
                        <TableCell className="font-mono text-xs">{r.iterations}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r === results.fm ? "—" : diff.toExponential(3)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <footer className="border-t border-border pt-4 pb-6 mt-4 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Academic attribution</p>
          <p>
            Fernández Molina, J. C.; Sigalotti, L. Di G.; Rendón, O.; Mejias, E. (2022).{" "}
            <em>A rapidly convergent method for solving third-order polynomials.</em>{" "}
            <span className="text-foreground">AIP Advances</span> 12, 045002.{" "}
            DOI:{" "}
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
