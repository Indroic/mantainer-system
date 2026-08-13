import { createFileRoute } from "@tanstack/react-router";
import {
  useExportOrderSheet,
  useOrderDetail,
} from "@/features/mantenimiento/hooks/use-maintenance";
import ExecutionPanel from "@/features/mantenimiento/components/execution-panel";
import { Button } from "@mantainer-system/ui/components/button";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { AlertTriangleIcon, DownloadIcon, WrenchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mantenimiento/$id")({
  component: MantenimientoDetalleComponent,
});

function MantenimientoDetalleComponent() {
  const { id } = Route.useParams();
  const { data: order, isLoading } = useOrderDetail(id);
  const exportSheet = useExportOrderSheet();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded bg-default/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-60 rounded bg-default/50" />
          <Skeleton className="h-60 md:col-span-2 rounded bg-default/50" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-10 bg-surface/20 border border-border rounded-2xl">
        <AlertTriangleIcon className="size-8 mx-auto text-rose-500 mb-2" />
        <p className="text-muted-foreground text-sm font-semibold">No se encontró la orden de trabajo solicitada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <WrenchIcon className="size-6 text-indigo-400" />
            Ejecución de Mantenimiento
          </h2>
          <p className="text-sm text-muted-foreground">
            Registra el avance, asigna repuestos del almacén e introduce el horómetro de liquidación
          </p>
        </div>

        {/* Hoja de OT en PDF: ficha del activo, repuestos y líneas de firma. */}
        <Button
          variant="outline"
          onClick={() => exportSheet.mutate(id)}
          disabled={exportSheet.isPending}
          className="h-8 shrink-0 gap-1.5 rounded-xl border-border px-4 text-xs font-semibold"
        >
          <DownloadIcon className="size-3.5" />
          Descargar OT (PDF)
        </Button>
      </div>

      <div className="pt-2">
        <ExecutionPanel order={order} />
      </div>
    </div>
  );
}
