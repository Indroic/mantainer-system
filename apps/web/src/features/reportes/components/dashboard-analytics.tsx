import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@mantainer-system/ui/components/card";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import {
  ArrowRightIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  CoinsIcon,
  PackageIcon,
  TrendingUpIcon,
  WrenchIcon,
} from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";
import { formatCurrency } from "@/features/mantenimiento/utils/order-costs";
import { useAnalyticsReport } from "../hooks/use-reportes";
import { REPORT_PERIODS, type ReportPeriod } from "../types";
import { MetricTile, RankingCard, TrendChart, percentOfMax } from "./analytics-panel";

/**
 * Resumen de reportes y estadísticas incrustado en el dashboard.
 *
 * El dashboard mostraba solo contadores de estado (cuántas máquinas, cuántas
 * OT); las estadísticas del periodo — gasto, repuestos más consumidos, índice de
 * averías y evolución del gasto — solo se veían entrando a /reportes. Aquí se
 * consultan con el MISMO endpoint analítico que esa pantalla, de modo que las
 * cifras no puedan divergir, y se muestran los primeros puestos de cada ranking
 * con un enlace al informe completo.
 *
 * Se reutilizan las piezas visuales de `AnalyticsPanel` (tarjeta de indicador,
 * barra de magnitud, serie temporal) en lugar de reimplementar gráficos: un solo
 * tono por tarjeta, la magnitud en la longitud de la barra y el valor siempre
 * escrito al lado.
 */

/** Cuántas filas se muestran por ranking en el resumen del dashboard. */
const TOP_N = 5;

export default function DashboardAnalytics() {
  // El dashboard arranca en la vista mensual: es el corte con el que se sigue el
  // día a día del taller. El informe completo permite cualquier rango.
  const [period, setPeriod] = useState<ReportPeriod>("MENSUAL");

  const { data: report, isLoading, isError } = useAnalyticsReport({
    period,
    scope: "GENERAL",
    machine_id: null,
    failure_category: null,
    limit: TOP_N,
  });

  return (
    <div className="space-y-4">
      {/* Cabecera de la sección con el selector de periodo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <BarChart3Icon className="size-4 text-cyan-400" />
            Reportes y Estadísticas
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {report
              ? `Gasto, consumo y averías · ${report.resolved_period.label}`
              : "Gasto, consumo y averías del periodo"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Conmutador de periodo: botones en lugar de desplegable porque son
              pocas opciones y se comparan de un vistazo. */}
          <div
            role="group"
            aria-label="Rango temporal de las estadísticas"
            className="flex items-center gap-1 rounded-xl border border-border bg-surface/40 p-1"
          >
            {REPORT_PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                aria-pressed={period === option.value}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                  period === option.value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Link
            to="/reportes"
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent/10"
          >
            Informe completo
            <ArrowRightIcon className="size-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl bg-default/50" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl bg-default/50" />
            ))}
          </div>
        </div>
      ) : isError || !report ? (
        <div className="rounded-2xl border border-border bg-surface/20 p-8 text-center">
          <AlertTriangleIcon className="mx-auto mb-2 size-7 text-rose-500" />
          <p className="text-sm font-semibold text-foreground">
            No se pudieron consolidar las estadísticas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vuelva a intentarlo en unos instantes o consulte el informe completo.
          </p>
        </div>
      ) : (
        <AnalyticsSummary report={report} />
      )}
    </div>
  );
}

function AnalyticsSummary({
  report,
}: {
  report: NonNullable<ReturnType<typeof useAnalyticsReport>["data"]>;
}) {
  const totals = report.totals;
  const topCosts = report.top_machines_by_cost ?? [];
  const topParts = report.top_spare_parts ?? [];
  const topFailures = report.top_machines_by_failures ?? [];
  const byCategory = report.failures_by_category ?? [];
  const trend = report.cost_trend ?? [];

  return (
    <div className="space-y-6">
      {/* Indicadores del periodo */}
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

      {/* Rankings del periodo (primeros puestos) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RankingCard
          title="Maquinaria con más gastos"
          description={`Inversión en repuestos por activo · ${report.resolved_period.label}`}
          emptyMessage="Sin gasto registrado en el periodo."
          rows={topCosts.slice(0, TOP_N).map((item) => ({
            key: item.machine_id ?? item.machine_code,
            primary: item.machine_code,
            secondary:
              `${item.machine_brand ?? ""} ${item.machine_model ?? ""}`.trim() || "—",
            value: formatCurrency(item.total_cost),
            note: `${item.orders_count} OT · ${item.percentage.toFixed(1)}% del total`,
            ratio: item.percentage,
          }))}
        />

        <RankingCard
          title="Repuestos más utilizados"
          description="Piezas con mayor consumo de unidades"
          emptyMessage="Sin consumo de repuestos en el periodo."
          rows={topParts.slice(0, TOP_N).map((item) => ({
            key: item.spare_part_id ?? item.spare_part_code,
            primary: item.spare_part_name,
            secondary: item.spare_part_code,
            value: `${item.total_quantity} u.`,
            note: `${formatCurrency(item.total_cost)} · ${item.orders_count} OT`,
            ratio: percentOfMax(
              item.total_quantity,
              topParts.map((p) => p.total_quantity),
            ),
          }))}
        />

        <RankingCard
          title="Mayor índice de averías"
          description="Número de órdenes de trabajo por activo"
          emptyMessage="Sin averías registradas en el periodo."
          tone="rose"
          rows={topFailures.slice(0, TOP_N).map((item) => ({
            key: item.machine_id ?? item.machine_code,
            primary: item.machine_code,
            secondary:
              `${item.machine_brand ?? ""} ${item.machine_model ?? ""}`.trim() || "—",
            value: `${item.failures_count} avería(s)`,
            note: `${item.percentage.toFixed(1)}% del total · ${formatCurrency(item.total_cost)}`,
            ratio: percentOfMax(
              item.failures_count,
              topFailures.map((f) => f.failures_count),
            ),
          }))}
        />

        <RankingCard
          title="Clasificación de fallas"
          description="Sistemas del activo que originan las intervenciones"
          emptyMessage="Sin fallas clasificadas en el periodo."
          tone="amber"
          rows={byCategory.slice(0, TOP_N).map((item) => ({
            key: item.category,
            primary: item.label,
            secondary: `${item.count} intervención(es)`,
            value: `${item.percentage.toFixed(1)}%`,
            note: formatCurrency(item.total_cost),
            ratio: item.percentage,
          }))}
        />
      </div>

      {/* Evolución del gasto en el periodo */}
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
