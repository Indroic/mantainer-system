import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@mantainer-system/ui/components/card";
import type { CostReportResponse } from "../types";
import { CoinsIcon, BarChart3Icon, CpuIcon, TrendingUpIcon } from "lucide-react";

interface CostReportPanelProps {
  report: CostReportResponse;
}

export default function CostReportPanel({ report }: CostReportPanelProps) {
  const breakdown = [...report.machines_cost_breakdown].sort((a, b) => b.spare_parts_cost - a.spare_parts_cost);
  const total = report.total_spare_parts_cost;

  return (
    <div className="space-y-6">
      {/* Tarjetas Analíticas de Cabecera */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden border-border bg-surface/20 backdrop-blur-md rounded-2xl shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Costo Total Acumulado en Repuestos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-mono text-3xl font-extrabold text-indigo-400">
                ${total.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Inversión acumulada en materiales de mantenimiento</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
              <CoinsIcon className="size-6 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border bg-surface/20 backdrop-blur-md rounded-2xl shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-emerald-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Activos Intervenidos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-mono text-3xl font-extrabold text-cyan-400">
                {breakdown.length}
              </p>
              <p className="text-xs text-muted-foreground">Máquinas que requirieron recambios físicos</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400">
              <CpuIcon className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border bg-surface/20 backdrop-blur-md rounded-2xl shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Costo Máximo por Activo
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-mono text-3xl font-extrabold text-emerald-400">
                ${(breakdown[0]?.spare_parts_cost || 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Máximo consumo registrado: {breakdown[0]?.machine_code || "N/A"}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUpIcon className="size-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Distribución de Costos NATIVO de Tailwind (Barras SVG Premium) */}
      <Card className="border-border bg-surface/20 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3Icon className="size-5 text-indigo-400 animate-pulse" />
            Distribución Financiera de Costos por Activo
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Comparativa acumulada del costo de repuestos consumidos por cada maquinaria pesada
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {breakdown.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm font-semibold">
              No hay suficientes datos financieros acumulados para generar la comparativa.
            </div>
          ) : (
            <div className="space-y-5">
              {breakdown.map((item) => {
                const percentage = total > 0 ? (item.spare_parts_cost / total) * 100 : 0;

                return (
                  <div key={item.machine_code} className="space-y-1.5 group">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground group-hover:text-indigo-400 transition-colors">
                          {item.machine_code}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          ({item.machine_brand} {item.machine_model})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-foreground/80">${item.spare_parts_cost.toFixed(2)}</span>
                        <span className="text-[10px] text-indigo-400">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>

                    {/* Barra de Progreso Premium SVG NATIVA */}
                    <div className="relative h-3 w-full rounded-full bg-background overflow-hidden border border-border">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-400 shadow-md shadow-indigo-600/30 transition-all duration-1000 ease-out group-hover:brightness-110"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
