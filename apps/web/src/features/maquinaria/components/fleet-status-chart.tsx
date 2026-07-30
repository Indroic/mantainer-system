import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mantainer-system/ui/components/card";
import { Button } from "@mantainer-system/ui/components/button";
import {
  CheckCircle2Icon,
  OctagonAlertIcon,
  TableIcon,
  TruckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";
import type { FleetStatusResponse, FleetStatusSlice } from "../types";

/**
 * Estado de la flota en porcentajes (spec 4.3).
 *
 * Forma elegida: barra apilada horizontal (100 %). El dato es una composición
 * parte-todo de tres categorías con nombres largos, no una serie temporal ni una
 * magnitud comparada, así que una barra apilada se lee mejor que un donut y no
 * obliga al usuario a comparar ángulos.
 *
 * Los colores son la paleta de ESTADO (bueno / advertencia / crítico) definida
 * como tokens en `globals.css`, con pasos propios y validados para cada modo.
 * El color nunca porta el significado en solitario: cada estado va acompañado de
 * icono, etiqueta directa con el porcentaje, leyenda y vista de tabla.
 */

interface FleetStatusChartProps {
  data: FleetStatusResponse | null | undefined;
  isLoading?: boolean;
}

interface StatusStyle {
  icon: LucideIcon;
  /** Token CSS con el paso validado para el modo activo. */
  fill: string;
  textClass: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  ACTIVA: {
    icon: CheckCircle2Icon,
    fill: "var(--chart-status-good)",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  EN_MANTENIMIENTO: {
    icon: WrenchIcon,
    fill: "var(--chart-status-warning)",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  FUERA_DE_SERVICIO: {
    icon: OctagonAlertIcon,
    fill: "var(--chart-status-critical)",
    textClass: "text-rose-700 dark:text-rose-400",
  },
};

const FALLBACK_STYLE: StatusStyle = {
  icon: TruckIcon,
  fill: "var(--muted-foreground)",
  textClass: "text-muted-foreground",
};

function styleFor(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? FALLBACK_STYLE;
}

// Geometría de la barra. El hueco de 2px entre segmentos es del color de la
// superficie: separa los tramos sin introducir una línea de otro color.
const BAR_HEIGHT = 34;
const SEGMENT_GAP = 2;
const RADIUS = 4;

export default function FleetStatusChart({ data, isLoading }: FleetStatusChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  // Solo entran al gráfico los estados con presencia real; los de 0 máquinas se
  // mantienen en la leyenda y en la tabla, pero no generan un tramo invisible.
  const slices: FleetStatusSlice[] = Array.isArray(data?.slices) ? data.slices : [];
  const total = Number(data?.total_machines ?? 0);
  const visibleSlices = useMemo(
    () => slices.filter((slice) => Number(slice?.count ?? 0) > 0),
    [slices],
  );

  if (isLoading) {
    return (
      <Card className="border-border bg-card rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="h-4 w-48 rounded bg-default/50 animate-pulse" />
          <div className="h-9 w-full rounded-lg bg-default/50 animate-pulse" />
          <div className="h-12 w-full rounded bg-default/40 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card rounded-2xl">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <TruckIcon className="size-4 text-accent" />
            Estado de la Flota
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Distribución operativa en tiempo real sobre {total}{" "}
            {total === 1 ? "máquina" : "máquinas"} en servicio
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowTable((prev) => !prev)}
          aria-pressed={showTable}
          className="rounded-lg border-border text-xs text-muted-foreground hover:text-foreground shrink-0 h-8 gap-1.5"
        >
          <TableIcon className="size-3.5" />
          {showTable ? "Ver gráfico" : "Ver tabla"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No hay maquinaria operativa registrada para calcular el estado de la flota.
          </p>
        ) : showTable ? (
          <FleetStatusTable slices={slices} total={total} />
        ) : (
          <>
            {/* ----- Barra apilada 100 % ----- */}
            <svg
              viewBox={`0 0 100 ${BAR_HEIGHT}`}
              preserveAspectRatio="none"
              className="w-full"
              style={{ height: BAR_HEIGHT }}
              role="img"
              aria-label={
                `Estado de la flota: ` +
                slices
                  .map((s) => `${s.label} ${s.percentage}% (${s.count})`)
                  .join(", ")
              }
            >
              {(() => {
                let cursor = 0;
                return visibleSlices.map((slice, index) => {
                  const style = styleFor(slice.status);
                  const isLast = index === visibleSlices.length - 1;
                  // Se dibuja sobre la proporción real, no sobre el porcentaje
                  // redondeado, para que los tramos sumen exactamente el 100 %.
                  const rawWidth = (Number(slice.count) / total) * 100;
                  const x = cursor;
                  cursor += rawWidth;

                  // El hueco se descuenta del ancho salvo en el último tramo,
                  // para que la barra termine justo en el borde derecho.
                  const width = Math.max(rawWidth - (isLast ? 0 : SEGMENT_GAP / 4), 0.4);
                  const dimmed = hovered !== null && hovered !== slice.status;

                  return (
                    <rect
                      key={slice.status}
                      x={x}
                      y={0}
                      width={width}
                      height={BAR_HEIGHT}
                      rx={RADIUS / 4}
                      fill={style.fill}
                      opacity={dimmed ? 0.35 : 1}
                      className="transition-opacity duration-150"
                      onMouseEnter={() => setHovered(slice.status)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <title>{`${slice.label}: ${slice.count} de ${total} (${slice.percentage}%)`}</title>
                    </rect>
                  );
                });
              })()}
            </svg>

            {/* ----- Leyenda con etiqueta directa (icono + nombre + %) -----
                Obligatoria: uno de los pasos de estado queda por debajo de 3:1
                en modo claro, así que el porcentaje va siempre escrito. */}
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {slices.map((slice) => {
                const style = styleFor(slice.status);
                const Icon = style.icon;
                const active = hovered === slice.status;

                return (
                  <li
                    key={slice.status}
                    onMouseEnter={() => setHovered(slice.status)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors",
                      active
                        ? "border-accent/40 bg-default/60"
                        : "border-border bg-background/60",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: style.fill }}
                    />
                    <Icon className={cn("size-3.5 shrink-0", style.textClass)} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                        {slice.label}
                      </p>
                      <p className="font-mono text-sm font-bold text-foreground">
                        {slice.percentage.toFixed(1)}%
                        <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                          ({slice.count})
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FleetStatusTable({
  slices,
  total,
}: {
  slices: FleetStatusSlice[];
  total: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <caption className="sr-only">
          Estado de la flota: máquinas y porcentaje por estado operativo
        </caption>
        <thead className="bg-background/80 text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-bold uppercase tracking-wider">
              Estado
            </th>
            <th scope="col" className="px-3 py-2 text-right font-bold uppercase tracking-wider">
              Máquinas
            </th>
            <th scope="col" className="px-3 py-2 text-right font-bold uppercase tracking-wider">
              Porcentaje
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {slices.map((slice) => {
            const style = styleFor(slice.status);
            const Icon = style.icon;
            return (
              <tr key={slice.status}>
                <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <Icon className={cn("size-3.5", style.textClass)} />
                    {slice.label}
                  </span>
                </th>
                <td className="px-3 py-2 text-right font-mono text-foreground/80">
                  {slice.count}
                </td>
                <td className="px-3 py-2 text-right font-mono text-foreground/80">
                  {slice.percentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-background/80 font-bold text-foreground">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">
              Total
            </th>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2 text-right font-mono">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
