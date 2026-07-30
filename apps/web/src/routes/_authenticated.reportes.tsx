import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useAnalyticsReport,
  useCostReport,
  useExportAnalyticsReport,
} from "@/features/reportes/hooks/use-reportes";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import AnalyticsPanel, {
  AnalyticsMachinePrompt,
} from "@/features/reportes/components/analytics-panel";
import CostReportPanel from "@/features/reportes/components/cost-report-panel";
import { Button } from "@mantainer-system/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mantainer-system/ui/components/select";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { BarChart3Icon, AlertTriangleIcon, DownloadIcon } from "lucide-react";
import { FAILURE_CATEGORIES } from "@/features/mantenimiento/types";
import {
  REPORT_PERIODS,
  type AnalyticsFilters,
  type ReportPeriod,
  type ReportScope,
} from "@/features/reportes/types";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesComponent,
});

/** Centinela de los selectores para representar "sin filtro". */
const ALL = "ALL";

function ReportesComponent() {
  const { canViewReports } = useAuth();

  // Filtros globales del reporte (spec 4.2): rango temporal y alcance.
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: "ANUAL",
    scope: "GENERAL",
    machine_id: null,
    failure_category: null,
    limit: 10,
  });

  const { data: machines = [] } = useMachines(undefined, { enabled: canViewReports });
  const { data: report, isLoading, isError } = useAnalyticsReport(filters);
  const { data: costReport } = useCostReport();
  const exportReport = useExportAnalyticsReport();

  const needsMachine = filters.scope === "INDIVIDUAL" && !filters.machine_id;

  if (!canViewReports) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface/20 p-6 py-12 text-center">
        <AlertTriangleIcon className="mx-auto mb-2 size-10 text-rose-500" />
        <p className="text-base font-bold text-foreground">Acceso Restringido</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No cuenta con los privilegios necesarios para consultar los reportes financieros
          analíticos del taller operativo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <BarChart3Icon className="size-6 text-accent" />
            Reportes y Analítica de Mantenimiento
          </h2>
          <p className="text-sm text-muted-foreground">
            Gastos acumulados por activo, repuestos más utilizados e índice de averías
          </p>
        </div>

        {/* Exportación profesional en PDF / Excel (spec 4.4) */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportReport.mutate({ filters, format: "xlsx" })}
            disabled={exportReport.isPending || needsMachine}
            className="h-8 gap-1.5 rounded-xl border-border px-4 text-xs font-semibold"
          >
            <DownloadIcon className="size-3.5" />
            Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => exportReport.mutate({ filters, format: "pdf" })}
            disabled={exportReport.isPending || needsMachine}
            className="h-8 gap-1.5 rounded-xl border-border px-4 text-xs font-semibold"
          >
            <DownloadIcon className="size-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* -------- Barra de filtros: una sola fila sobre los gráficos -------- */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/40 p-4 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
        {/* Rango temporal: Anual / Mensual / Semanal */}
        <FilterField label="Rango temporal">
          <Select
            value={filters.period}
            onValueChange={(val: any) =>
              setFilters((prev) => ({ ...prev, period: (val || "ANUAL") as ReportPeriod }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl border-border bg-default/60 text-sm text-foreground">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border bg-overlay text-foreground">
              {REPORT_PERIODS.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {/* Alcance: General (empresa) o Individual (activo) */}
        <FilterField label="Alcance del reporte">
          <Select
            value={filters.scope}
            onValueChange={(val: any) =>
              setFilters((prev) => ({
                ...prev,
                scope: (val || "GENERAL") as ReportScope,
                // Al volver a General se limpia la máquina para que no quede un
                // filtro aplicado de forma invisible.
                machine_id: val === "GENERAL" ? null : prev.machine_id,
              }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl border-border bg-default/60 text-sm text-foreground">
              <SelectValue placeholder="Alcance" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border bg-overlay text-foreground">
              <SelectItem value="GENERAL">General (toda la empresa)</SelectItem>
              <SelectItem value="INDIVIDUAL">Individual (por máquina)</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        {/* Máquina: solo aplicable con alcance Individual */}
        <FilterField label="Maquinaria">
          <Select
            value={filters.machine_id ?? ALL}
            onValueChange={(val: any) =>
              setFilters((prev) => ({
                ...prev,
                machine_id: !val || val === ALL ? null : val,
                // Elegir una máquina implica un reporte individual.
                scope: !val || val === ALL ? prev.scope : "INDIVIDUAL",
              }))
            }
          >
            <SelectTrigger
              className="h-9 rounded-xl border-border bg-default/60 text-sm text-foreground"
              disabled={filters.scope === "GENERAL"}
            >
              <SelectValue placeholder="Seleccione un activo" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border bg-overlay text-foreground">
              <SelectItem value={ALL}>Todas las máquinas</SelectItem>
              {machines.map((machine) => (
                <SelectItem key={machine.id} value={machine.id}>
                  {machine.code} ({machine.brand} {machine.model})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {/* Segmentación por clasificación de falla (spec 4.1) */}
        <FilterField label="Clasificación de falla">
          <Select
            value={filters.failure_category ?? ALL}
            onValueChange={(val: any) =>
              setFilters((prev) => ({
                ...prev,
                failure_category: !val || val === ALL ? null : val,
              }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl border-border bg-default/60 text-sm text-foreground">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border bg-overlay text-foreground">
              <SelectItem value={ALL}>Todas las clasificaciones</SelectItem>
              {FAILURE_CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      {/* -------- Contenido -------- */}
      {needsMachine ? (
        <AnalyticsMachinePrompt />
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl bg-default/50" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-2xl bg-default/50" />
            ))}
          </div>
        </div>
      ) : isError || !report ? (
        <div className="rounded-2xl border border-border bg-surface/20 p-10 text-center">
          <AlertTriangleIcon className="mx-auto mb-2 size-8 text-rose-500" />
          <p className="text-sm font-semibold text-foreground">
            No se pudieron consolidar los datos analíticos
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste los filtros o vuelva a intentarlo en unos instantes.
          </p>
        </div>
      ) : (
        <>
          <AnalyticsPanel report={report} />

          {/* Desglose histórico de costos (vista clásica), como complemento. */}
          {costReport && (
            <div className="pt-2">
              <CostReportPanel report={costReport} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
