import { createFileRoute } from "@tanstack/react-router";
import { useOrderDetail } from "@/features/mantenimiento/hooks/use-maintenance";
import ExecutionPanel from "@/features/mantenimiento/components/execution-panel";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { AlertTriangleIcon, WrenchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mantenimiento/$id")({
  component: MantenimientoDetalleComponent,
});

function MantenimientoDetalleComponent() {
  const { id } = Route.useParams();
  const { data: order, isLoading } = useOrderDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-60 rounded bg-slate-800" />
          <Skeleton className="h-60 md:col-span-2 rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-10 bg-slate-900/20 border border-slate-800 rounded-2xl">
        <AlertTriangleIcon className="size-8 mx-auto text-rose-500 mb-2" />
        <p className="text-slate-500 text-sm font-semibold">No se encontró la orden de trabajo solicitada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <WrenchIcon className="size-6 text-indigo-400" />
          Ejecución de Mantenimiento
        </h2>
        <p className="text-sm text-slate-400">
          Registra el avance, asigna repuestos del almacén e introduce el horómetro de liquidación
        </p>
      </div>

      <div className="pt-2">
        <ExecutionPanel order={order} />
      </div>
    </div>
  );
}
