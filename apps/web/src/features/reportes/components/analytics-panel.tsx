import { Badge } from "@mantainer-system/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@mantainer-system/ui/components/card";
import {
  AlertTriangleIcon,
  CoinsIcon,
  PackageIcon,
  TrendingUpIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";
import { formatCurrency } from "@/features/mantenimiento/utils/order-costs";
import type { AnalyticsReportResponse } from "../types";

/**
 * Módulo de analítica avanzada (spec 4.2).
 *
 * Tres rankings sobre el mismo recorte temporal y de alcance:
 *   · Maquinaria con más gastos acumulados.
 *   · Partes / repuestos más utilizados.
 *   · Máquinas con mayor índice de averías.
 *
 * La forma es una **barra de magnitud** por fila (no un gráfico de tarta): el
 * trabajo del lector es comparar magnitudes ordenadas, y una barra alineada a un
 * único eje se compara mejor que ángulos. Cada barra usa un solo tono del acento
 * (escala secuencial: más largo = más gasto) y el valor va SIEMPRE escrito al
 * lado, de modo que el color nunca es el único portador del dato.
 */

interface AnalyticsPanelProps {
  report: AnalyticsReportResponse;
}

export default function AnalyticsPanel({ report }: AnalyticsPanelProps) {
  const totals = report.totals;
  const topCosts = report.top_machines_by_cost ?? [];
  const topParts = report.top_spare_parts ?? [];
  const topFailures = report.top_machines_by_failures ?? [];
  const byCategory = report.failures_by_category ?? [];
  const trend = report.cost_trend ?? [];

  return (
    <div className="space-y-6">
      {/* ---------- Indicadores del periodo ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Gasto en repuestos"
          value={formatCurrency(totals.total_spare_parts_cost)}
          hint={report.resolved_period.label}
          icon={CoinsIcon}
        />
        <MetricTile
          label="Órdenes de trabajo"
          value={String(totals.total_orders)}
          hint={`${totals.liquidated_orders} liquidadas · ${totals.open_orders} abiertas`}
          icon={WrenchIcon}
        />
        <MetricTile
          label="Unidades consumidas"
          value={String(totals.total_units_consumed)}
          hint="Piezas de recambio utilizadas"
          icon={PackageIcon}
        />
        <MetricTile
          label="Costo medio por OT"
          value={formatCurrency(totals.average_cost_per_order)}
          hint={`${totals.machines_with_failures} máquina(s) intervenida(s)`}
          icon={TrendingUpIcon}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ---------- Maquinaria con más gastos acumulados ---------- */}
        <RankingCard
          title="Maquinaria con más gastos acumulados"
          description="Inversión en repuestos por activo en el periodo seleccionado"
          emptyMessage="Sin gasto registrado en el periodo."
          rows={topCosts.map((item) => ({
            key: item.machine_id ?? item.machine_code,
            primary: item.machine_code,
            secondary: `${item.machine_brand ?? ""} ${item.machine_model ?? ""}`.trim() || "—",
            value: formatCurrency(item.total_cost),
            note: `${item.orders_count} OT · ${item.percentage.toFixed(1)}% del total`,
            ratio: item.percentage,
          }))}
        />

        {/* ---------- Repuestos más utilizados ---------- */}
        <RankingCard
          title="Partes / repuestos más utilizados"
          description="Piezas con mayor consumo de unidades"
          emptyMessage="Sin consumo de repuestos en el periodo."
          rows={topParts.map((item) => ({
            key: item.spare_part_id ?? item.spare_part_code,
            primary: item.spare_part_name,
            secondary: item.spare_part_code,
            value: `${item.total_quantity} u.`,
            note: `${formatCurrency(item.total_cost)} · ${item.orders_count} OT`,
            // La barra se normaliza contra el más consumido: el lector compara
            // entre sí, que es lo que pide un ranking.
            ratio: percentOfMax(item.total_quantity, topParts.map((p) => p.total_quantity)),
          }))}
        />

        {/* ---------- Índice de averías ---------- */}
        <RankingCard
          title="Máquinas con mayor índice de averías"
          description="Número de órdenes de trabajo registradas por activo"
          emptyMessage="Sin averías registradas en el periodo."
          tone="rose"
          rows={topFailures.map((item) => ({
            key: item.machine_id ?? item.machine_code,
            primary: item.machine_code,
            secondary: `${item.machine_brand ?? ""} ${item.machine_model ?? ""}`.trim() || "—",
            value: `${item.failures_count} avería(s)`,
            note: `${item.percentage.toFixed(1)}% del total · ${formatCurrency(item.total_cost)}`,
            ratio: percentOfMax(
              item.failures_count,
              topFailures.map((f) => f.failures_count),
            ),
          }))}
        />

        {/* ---------- Clasificación de fallas (spec 4.1) ---------- */}
        <RankingCard
          title="Distribución por clasificación de falla"
          description="Sistemas del activo que originan las intervenciones"
          emptyMessage="Sin fallas clasificadas en el periodo."
          tone="amber"
          rows={byCategory.map((item) => ({
            key: item.category,
            primary: item.label,
            secondary: `${item.count} intervención(es)`,
            value: `${item.percentage.toFixed(1)}%`,
            note: formatCurrency(item.total_cost),
            ratio: item.percentage,
          }))}
        />
      </div>

      {/* ---------- Evolución del gasto ---------- */}
      {trend.length > 0 && (
        <Card className="rounded-2xl border-border bg-surface/20">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <TrendingUpIcon className="size-4 text-accent" />
              Evolución del gasto · {report.resolved_period.label}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Gasto en repuestos y número de órdenes por tramo del periodo
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <TrendChart trend={trend} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Porcentaje del valor respecto al máximo de la serie (para normalizar barras). */
export function percentOfMax(value: number, all: number[]): number {
  const max = Math.max(...all, 0);
  return max > 0 ? (value / max) * 100 : 0;
}

export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="rounded-2xl border-border bg-card">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="font-mono text-xl font-extrabold text-foreground">{value}</p>
          <p className="truncate text-[10px] text-muted-foreground/80">{hint}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-accent/20 bg-accent/10 p-2.5 text-accent">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export interface RankingRow {
  key: string;
  primary: string;
  secondary: string;
  value: string;
  note: string;
  /** 0–100: longitud relativa de la barra de magnitud. */
  ratio: number;
}

export function RankingCard({
  title,
  description,
  rows,
  emptyMessage,
  tone = "accent",
}: {
  title: string;
  description: string;
  rows: RankingRow[];
  emptyMessage: string;
  tone?: "accent" | "rose" | "amber";
}) {
  // Un solo tono por tarjeta (escala secuencial): la longitud porta la magnitud,
  // el color solo agrupa. Nunca una paleta categórica por fila.
  const barTones = {
    accent: "bg-accent",
    rose: "bg-rose-500",
    amber: "bg-amber-500",
  } as const;

  return (
    <Card className="rounded-2xl border-border bg-surface/20">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          rows.map((row, index) => (
            <div key={row.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="truncate text-xs font-semibold text-foreground">
                    {row.primary}
                  </span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {row.secondary}
                  </span>
                </div>
                {/* El valor va escrito siempre: la barra no es el único canal. */}
                <span className="shrink-0 font-mono text-xs font-bold text-foreground">
                  {row.value}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-default/60">
                  <div
                    className={cn("h-full rounded-full", barTones[tone])}
                    style={{ width: `${Math.max(Math.min(row.ratio, 100), 1.5)}%` }}
                  />
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{row.note}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Serie temporal como columnas. Un solo tono (magnitud), etiquetas del eje X
 * legibles y el valor en el tooltip nativo de cada columna.
 */
export function TrendChart({
  trend,
}: {
  trend: AnalyticsReportResponse["cost_trend"];
}) {
  const maxCost = Math.max(...trend.map((b) => b.total_cost), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ height: 160 }}>
        {trend.map((bucket) => {
          const heightPct = maxCost > 0 ? (bucket.total_cost / maxCost) * 100 : 0;
          return (
            <div
              key={bucket.bucket_start}
              className="flex min-w-10 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${bucket.label}: ${formatCurrency(bucket.total_cost)} · ${bucket.orders_count} OT`}
            >
              <span className="font-mono text-[9px] font-bold text-muted-foreground">
                {bucket.orders_count}
              </span>
              <div
                className="w-full rounded-t bg-accent transition-all"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {trend.map((bucket) => (
          <span
            key={`${bucket.bucket_start}-label`}
            className="min-w-10 flex-1 truncate text-center text-[9px] font-medium text-muted-foreground"
          >
            {bucket.label}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2 rounded-[3px] bg-accent" aria-hidden="true" />
          Gasto en repuestos (altura)
        </span>
        <span className="text-[10px] text-muted-foreground">
          El número sobre cada columna es la cantidad de OT
        </span>
      </div>
    </div>
  );
}

/** Aviso reutilizable cuando el reporte Individual aún no tiene máquina elegida. */
export function AnalyticsMachinePrompt() {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-8 text-center">
      <AlertTriangleIcon className="mx-auto mb-2 size-7 text-amber-500" />
      <p className="text-sm font-semibold text-foreground">
        Seleccione una máquina
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        El reporte Individual necesita un activo concreto. Elija uno en el filtro
        superior o cambie el alcance a{" "}
        <Badge className="rounded-md border border-border bg-default/60 px-1.5 py-0 text-[10px] font-bold">
          General
        </Badge>
        .
      </p>
    </div>
  );
}
