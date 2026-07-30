import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Button } from "@mantainer-system/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@mantainer-system/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mantainer-system/ui/components/select";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  PackageCheckIcon,
  PackageIcon,
  TruckIcon,
} from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAlerts } from "@/features/alertas/hooks/use-notifications";
import {
  useDispatchSolvency,
  useDownloadSolvencyPdf,
  useSolvencies,
} from "@/features/mantenimiento/hooks/use-solvencies";
import { formatCurrency } from "@/features/mantenimiento/utils/order-costs";
import type { SolvencyStatus } from "@/features/mantenimiento/types";

export const Route = createFileRoute("/_authenticated/almacen")({
  component: AlmacenComponent,
});

/**
 * Bandeja de Despacho de Almacén (spec 2.3 / 3.3).
 *
 * Muestra el listado de piezas que Almacén debe entregar según las Solvencias de
 * Repuestos emitidas por el Planificador, permite descargar cada comprobante en
 * PDF y confirmar la entrega. Incluye las alertas de bajo stock, que en este rol
 * sí son pertinentes.
 */
function AlmacenComponent() {
  const { canViewSolvencies, canDispatchSolvencies, canViewFinancials, isWarehouse } =
    useAuth();
  const [statusFilter, setStatusFilter] = useState<SolvencyStatus | "ALL">(
    "PENDIENTE_DESPACHO",
  );

  const { data: solvencies = [], isLoading } = useSolvencies({ status: statusFilter });
  // Las alertas ya vienen filtradas por rol desde el servidor.
  const { data: alerts = [] } = useAlerts({ enabled: canViewSolvencies });

  const downloadPdf = useDownloadSolvencyPdf();
  const dispatchSolvency = useDispatchSolvency();

  const lowStockAlerts = useMemo(
    () => alerts.filter((alert) => alert.type === "LOW_STOCK"),
    [alerts],
  );

  const pendingUnits = useMemo(
    () =>
      solvencies
        .filter((s) => s.status === "PENDIENTE_DESPACHO")
        .reduce((acc, s) => acc + Number(s.total_units ?? 0), 0),
    [solvencies],
  );

  if (!canViewSolvencies) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/20 p-6 py-12 text-center">
        <AlertTriangleIcon className="mx-auto mb-2 size-10 text-rose-500" />
        <p className="text-base font-bold text-foreground">Acceso Restringido</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No cuenta con los privilegios necesarios para consultar la bandeja de despacho.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <TruckIcon className="size-6 text-accent" />
            Despacho de Repuestos
          </h2>
          <p className="text-sm text-muted-foreground">
            Piezas por entregar según las Solvencias de Repuestos autorizadas por el
            Planificador
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={statusFilter}
            onValueChange={(val: any) => setStatusFilter(val || "ALL")}
          >
            <SelectTrigger className="rounded-xl border-border bg-default/60 text-foreground">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border bg-overlay text-foreground">
              <SelectItem value="PENDIENTE_DESPACHO">Pendientes de despacho</SelectItem>
              <SelectItem value="DESPACHADO">Ya despachadas</SelectItem>
              <SelectItem value="ALL">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile
          label="Solvencias en lista"
          value={solvencies.length}
          icon={FileTextIcon}
          tone="accent"
        />
        <MetricTile
          label="Unidades por entregar"
          value={pendingUnits}
          icon={PackageIcon}
          tone="amber"
        />
        <MetricTile
          label="Alertas de bajo stock"
          value={lowStockAlerts.length}
          icon={AlertTriangleIcon}
          tone={lowStockAlerts.length > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Alertas de bajo stock: relevantes para Almacén (spec 2.3) */}
      {lowStockAlerts.length > 0 && (
        <Card className="rounded-2xl border-rose-500/25 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
              <AlertTriangleIcon className="size-4" />
              Reposición requerida
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Repuestos por debajo del stock mínimo configurado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {lowStockAlerts.map((alert) => (
              <p key={alert.id} className="text-xs leading-relaxed text-foreground/80">
                • {alert.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Listado de Solvencias */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl bg-default/50" />
          ))}
        </div>
      ) : solvencies.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface/20 p-10 text-center">
          <CheckCircle2Icon className="mx-auto mb-2 size-8 text-emerald-500" />
          <p className="text-sm font-semibold text-foreground">
            No hay solvencias {statusFilter === "PENDIENTE_DESPACHO" ? "pendientes" : ""} en
            la bandeja
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando el Planificador asigne repuestos a una OT, el documento aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {solvencies.map((solvency) => {
            const dispatched = solvency.status === "DESPACHADO";
            const items = Array.isArray(solvency.items) ? solvency.items : [];

            return (
              <Card key={solvency.id} className="rounded-2xl border-border bg-surface/20">
                <CardHeader className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-accent">
                        {solvency.code}
                      </span>
                      <Badge
                        className={cn(
                          "rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase",
                          dispatched
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {dispatched ? "Despachado" : "Pendiente de despacho"}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Maquinaria {solvency.machine_code || solvency.machine_id}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {solvency.order_description || "Orden de trabajo asociada"}
                    </CardDescription>
                    <p className="text-[10px] text-muted-foreground/80">
                      Emitida por {solvency.issued_by_name || solvency.issued_by} el{" "}
                      {new Date(solvency.created_at).toLocaleString()}
                      {dispatched && solvency.dispatched_by_name
                        ? ` · Entregada por ${solvency.dispatched_by_name}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadPdf.mutate({ id: solvency.id, code: solvency.code })
                      }
                      disabled={downloadPdf.isPending}
                      className="h-8 gap-1.5 rounded-xl border-border text-xs"
                    >
                      <DownloadIcon className="size-3.5" />
                      PDF
                    </Button>
                    {canDispatchSolvencies && !dispatched && (
                      <Button
                        type="button"
                        onClick={() => dispatchSolvency.mutate(solvency.id)}
                        disabled={dispatchSolvency.isPending}
                        className="h-8 gap-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <PackageCheckIcon className="size-3.5" />
                        Confirmar entrega
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="overflow-x-auto rounded-xl border border-border bg-background/80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-background/80 text-[10px] font-bold uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Repuesto</th>
                          <th className="px-3 py-2 text-right">Cantidad</th>
                          {canViewFinancials && (
                            <th className="px-3 py-2 text-right">Subtotal</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((item) => (
                          <tr key={item.id} className="text-foreground/80">
                            <td className="px-3 py-2 font-mono font-bold text-accent">
                              {item.spare_part_code}
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground">
                              {item.spare_part_name}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold">
                              {item.quantity}
                            </td>
                            {canViewFinancials && (
                              <td className="px-3 py-2 text-right font-mono">
                                {formatCurrency(item.subtotal)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-background/80 font-bold text-foreground">
                        <tr>
                          <td className="px-3 py-2" colSpan={2}>
                            Total
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {solvency.total_units}
                          </td>
                          {canViewFinancials && (
                            <td className="px-3 py-2 text-right font-mono text-accent">
                              {formatCurrency(solvency.total_cost)}
                            </td>
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Almacén no navega al detalle de la OT: no participa en el taller. */}
                  {!isWarehouse && (
                    <div className="mt-3 flex justify-end">
                      <Link
                        to="/mantenimiento/$id"
                        params={{ id: solvency.maintenance_order_id }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
                      >
                        Ver Orden de Trabajo
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof PackageIcon;
  tone: "accent" | "amber" | "rose" | "emerald";
}) {
  const tones = {
    accent: "bg-accent/10 border-accent/20 text-accent",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
    emerald:
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  } as const;

  return (
    <Card className="rounded-2xl border-border bg-card">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="font-mono text-2xl font-extrabold text-foreground">{value}</p>
        </div>
        <div className={cn("shrink-0 rounded-xl border p-3", tones[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
