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
import { ArrowLeft, Eye, Globe, Users, TrendingUp } from "lucide-react";

interface Visit {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
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
                      <TableHead>Ruta</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Origen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.slice(0, 50).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(v.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{v.path}</TableCell>
                        <TableCell className="text-xs">
                          {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]">
                          {v.referrer || "Directo"}
                        </TableCell>
                      </TableRow>
                    ))}
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
