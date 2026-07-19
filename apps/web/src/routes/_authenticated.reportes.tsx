import { createFileRoute } from "@tanstack/react-router";
import { useCostReport } from "@/features/reportes/hooks/use-reportes";
import { useAuth } from "@/features/auth/hooks/use-auth";
import CostReportPanel from "@/features/reportes/components/cost-report-panel";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { BarChart3Icon, AlertTriangleIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesComponent,
});

function ReportesComponent() {
  const { isAdmin, isSupervisor } = useAuth();
  const { data: report, isLoading } = useCostReport();

  const isAuthorized = isAdmin || isSupervisor;

  if (!isAuthorized) {
    return (
      <div className="text-center py-12 bg-slate-900/20 border border-slate-800 rounded-3xl p-6 max-w-xl mx-auto">
        <AlertTriangleIcon className="size-10 mx-auto text-rose-500 mb-2" />
        <p className="text-slate-200 text-base font-bold">Acceso Restringido</p>
        <p className="text-slate-400 text-xs mt-1">
          No cuenta con los privilegios necesarios para consultar los reportes financieros analíticos del taller operativo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3Icon className="size-6 text-indigo-400 animate-pulse" />
          Reportes y Costos de Mantenimiento
        </h2>
        <p className="text-sm text-slate-400">
          Distribución de costos financieros reales acumulados en repuestos (sin mano de obra)
        </p>
      </div>

      <div className="pt-2">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-28 rounded-2xl bg-slate-800/40" />
              <Skeleton className="h-28 rounded-2xl bg-slate-800/40" />
              <Skeleton className="h-28 rounded-2xl bg-slate-800/40" />
            </div>
            <Skeleton className="h-80 rounded-2xl bg-slate-800/45" />
          </div>
        ) : report ? (
          <CostReportPanel report={report} />
        ) : (
          <div className="text-center py-10 text-slate-500">
            No se pudieron consolidar los datos financieros.
          </div>
        )}
      </div>
    </div>
  );
}
