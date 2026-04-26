import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Eye, Globe, Users, TrendingUp, UserPlus, Repeat, UserCheck } from "lucide-react";

interface Visit {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
  visitor_id: string | null;
}

const Analytics = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Analytics — Cubic Clarity Engine";
    const load = async () => {
      const { data } = await supabase
        .from("page_visits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setVisits((data as Visit[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const total = visits.length;
  const last24h = visits.filter(
    (v) => new Date(v.created_at).getTime() > Date.now() - 86_400_000
  ).length;
  const countries = new Set(visits.map((v) => v.country).filter(Boolean));
  const paths = visits.reduce<Record<string, number>>((acc, v) => {
    acc[v.path] = (acc[v.path] ?? 0) + 1;
    return acc;
  }, {});
  const countryCounts = visits.reduce<Record<string, number>>((acc, v) => {
    const key = v.country ?? "Desconocido";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  // ---------- Métricas de visitantes únicos ----------
  // Mapa: visitor_id -> { firstSeen, count }
  const visitorStats = new Map<string, { firstSeen: number; count: number }>();
  for (const v of visits) {
    if (!v.visitor_id) continue;
    const ts = new Date(v.created_at).getTime();
    const prev = visitorStats.get(v.visitor_id);
    if (!prev) {
      visitorStats.set(v.visitor_id, { firstSeen: ts, count: 1 });
    } else {
      prev.count += 1;
      if (ts < prev.firstSeen) prev.firstSeen = ts;
    }
  }

  const uniqueVisitors = visitorStats.size;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newToday = Array.from(visitorStats.values()).filter(
    (s) => s.firstSeen >= startOfToday.getTime()
  ).length;
  const recurring = Array.from(visitorStats.values()).filter((s) => s.count > 1).length;
  const legacyVisits = visits.filter((v) => !v.visitor_id).length;

  // Para badges en la tabla: marcar la primera visita de cada visitor
  const firstVisitIds = new Set<string>();
  for (const [vid, stats] of visitorStats.entries()) {
    // Buscamos el id de la fila correspondiente a su primera visita
    const firstVisit = visits
      .filter((v) => v.visitor_id === vid)
      .reduce((earliest, cur) =>
        new Date(cur.created_at).getTime() === stats.firstSeen ? cur : earliest
      );
    if (firstVisit) firstVisitIds.add(firstVisit.id);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Panel de visitas</h1>
            <p className="text-muted-foreground mt-1">
              Estadísticas en vivo del Cubic Clarity Engine
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al dashboard
            </Button>
          </Link>
        </div>

        {/* Tarjetas de visitantes únicos (lo más relevante) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Visitantes únicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{uniqueVisitors}</div>
              {legacyVisits > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  + {legacyVisits} visitas previas sin ID
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-success" /> Nuevos hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{newToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Repeat className="h-4 w-4" /> Recurrentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{recurring}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tarjetas existentes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" /> Visitas totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Últimas 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{last24h}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Globe className="h-4 w-4" /> Países
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{countries.size}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Rutas distintas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Object.keys(paths).length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Visitas por país</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(countryCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([country, count]) => (
                  <div
                    key={country}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                  >
                    <span className="text-sm">{country}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              {Object.keys(countryCounts).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos aún</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Páginas más visitadas</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(paths)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([path, count]) => (
                  <div
                    key={path}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                  >
                    <span className="text-sm font-mono">{path}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visitas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay visitas registradas. Compartí el enlace y volvé acá.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Origen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.slice(0, 50).map((v) => {
                      let typeBadge;
                      if (!v.visitor_id) {
                        typeBadge = (
                          <Badge variant="outline" className="text-[10px]">
                            histórico
                          </Badge>
                        );
                      } else if (firstVisitIds.has(v.id)) {
                        typeBadge = (
                          <Badge className="bg-success text-success-foreground text-[10px]">
                            Nuevo
                          </Badge>
                        );
                      } else {
                        typeBadge = (
                          <Badge variant="secondary" className="text-[10px]">
                            Recurrente
                          </Badge>
                        );
                      }
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(v.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{typeBadge}</TableCell>
                          <TableCell className="font-mono text-xs">{v.path}</TableCell>
                          <TableCell className="text-xs">
                            {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">
                            {v.referrer || "Directo"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Analytics;
