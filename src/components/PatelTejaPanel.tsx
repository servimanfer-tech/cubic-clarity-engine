import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle, FlaskConical, PlayCircle, Github } from "lucide-react";
import {
  runPatelTejaValidation,
  type BenchmarkReport,
  FM_TOLERANCE_PCT,
  CONSENSUS_TOLERANCE_PCT,
} from "@/lib/patelTejaBenchmark";

const fmtSmart = (v: number) => {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs >= 1e-4 && abs < 1e6) return v.toPrecision(8);
  return v.toExponential(6);
};

const fmtPct = (v: number) => {
  if (!Number.isFinite(v)) return "∞";
  if (v < 1e-12) return "≈0";
  if (v < 1e-3) return v.toExponential(3) + " %";
  return v.toFixed(4) + " %";
};

export const PatelTejaPanel = () => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);

  const run = () => setReport(runPatelTejaValidation());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" />
          Patel-Teja propylene benchmark — paper Tables I & II
        </CardTitle>
        <div className="flex items-center gap-2">
          {report && (
            report.overallPass ? (
              <Badge className="bg-success text-success-foreground gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> PASS
              </Badge>
            ) : (
              <Badge className="bg-destructive text-destructive-foreground gap-1">
                <XCircle className="h-3.5 w-3.5" /> FAIL
              </Badge>
            )
          )}
          <Button size="sm" onClick={run} className="gap-1">
            <PlayCircle className="h-4 w-4" />
            Run Patel-Teja benchmark
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!report ? (
          <p className="text-sm text-muted-foreground">
            Click <span className="font-medium">Run Patel-Teja benchmark</span> to reproduce
            the three published cases (Z, ρ, V) using Fernández Molina, Cardano and Newton-Raphson.
            Tolerance: FM &lt; {FM_TOLERANCE_PCT}% on case ρ; FM↔Cardano consensus &lt; {CONSENSUS_TOLERANCE_PCT}%
            on the IEEE-754-limited cases.
          </p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Run at {new Date(report.generatedAt).toLocaleString()} · precision: {report.precision}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Paper value</TableHead>
                  <TableHead className="text-right">Error vs paper</TableHead>
                  <TableHead className="text-right">Error vs consensus</TableHead>
                  <TableHead className="text-right">Iter / terms</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.cases.flatMap((cr) => [
                  ...cr.methods.map((m, i) => (
                    <TableRow key={`${cr.case.id}-${m.method}`}>
                      {i === 0 ? (
                        <TableCell rowSpan={3} className="align-top">
                          <div className="font-medium">{cr.case.id}</div>
                          <div className="text-[10px] text-muted-foreground max-w-[180px]">
                            {cr.case.label}
                          </div>
                          {cr.case.doublePrecisionLimited && (
                            <Badge variant="outline" className="mt-1 text-[9px] py-0 h-4 gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> IEEE-754 limited
                            </Badge>
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell className="font-medium">{m.method}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtSmart(m.picked)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.method === "Cardano" && cr.case.expectedCardano !== undefined
                          ? fmtSmart(cr.case.expectedCardano)
                          : fmtSmart(cr.case.expectedFM)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtPct(m.errorVsPaperFM_pct)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtPct(m.errorVsConsensus_pct)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {m.iterations}
                      </TableCell>
                      <TableCell>
                        {m.failExpected ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <AlertTriangle className="h-3 w-3 text-warning" /> fails-in-paper
                          </Badge>
                        ) : m.pass ? (
                          <Badge className="bg-success text-success-foreground gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> PASS
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive text-destructive-foreground gap-1 text-[10px]">
                            <XCircle className="h-3 w-3" /> FAIL
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )),
                  <TableRow key={`${cr.case.id}-diag`} className="bg-muted/30">
                    <TableCell colSpan={8} className="py-2">
                      <div className="space-y-1 text-[11px]">
                        <div className="font-medium text-foreground">
                          Diagnóstico numérico (caso {cr.case.id})
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 font-mono">
                          <div>
                            p = {fmtSmart(cr.diagnostics.p)}
                            {cr.case.paperP !== undefined && (
                              <span className="text-muted-foreground">
                                {" "}· paper: {fmtSmart(cr.case.paperP)} (Δ {fmtPct(cr.diagnostics.pErrorPct)})
                              </span>
                            )}
                          </div>
                          <div>
                            q = {fmtSmart(cr.diagnostics.q)}
                            {cr.case.paperQ !== undefined && (
                              <span className="text-muted-foreground">
                                {" "}· paper: {fmtSmart(cr.case.paperQ)} (Δ {fmtPct(cr.diagnostics.qErrorPct)})
                              </span>
                            )}
                          </div>
                          <div>
                            Δ = {fmtSmart(cr.diagnostics.delta)}
                            {cr.case.paperDelta !== undefined && (
                              <span className="text-muted-foreground">
                                {" "}· paper: {fmtSmart(cr.case.paperDelta)} (Δ {fmtPct(cr.diagnostics.deltaErrorPct)})
                              </span>
                            )}
                          </div>
                          <div>
                            4Δ/q² = {fmtSmart(cr.diagnostics.ratio4DeltaOverQ2)}
                            {cr.case.paperRatio4DeltaOverQ2 !== undefined && (
                              <span className="text-muted-foreground">
                                {" "}· paper: {fmtSmart(cr.case.paperRatio4DeltaOverQ2)} (Δ {fmtPct(cr.diagnostics.ratioErrorPct)})
                              </span>
                            )}
                          </div>
                        </div>
                        {cr.case.technicalNote && (
                          <div className="pt-1 text-muted-foreground italic">
                            {cr.case.technicalNote}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>,
                ])}
              </TableBody>
            </Table>

            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
              <p>
                <span className="font-medium text-foreground">IEEE-754 disclosure.</span>{" "}
                Cases <span className="font-mono">Z</span> and <span className="font-mono">V</span>{" "}
                are flagged double-precision-limited: the published roots
                ({" "}
                <span className="font-mono">8.77e-10</span>,{" "}
                <span className="font-mono">1.0626</span>) lie below the round-off floor of their
                polynomials when evaluated in double precision (<code>f(expected)</code> is dominated by
                cancellation noise). All three solvers therefore converge to the same
                double-precision root and the test enforces FM↔Cardano agreement instead of paper
                fidelity. Reproducing the literal paper values requires extended-precision arithmetic.
              </p>
              <p>
                Case <span className="font-mono">ρ</span> is well-conditioned and is enforced at full
                paper fidelity (FM error &lt; {FM_TOLERANCE_PCT}%).
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
