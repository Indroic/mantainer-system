import { createFileRoute } from "@tanstack/react-router";
import { useAuditLogs } from "@/features/reportes/hooks/use-reportes";
import { useAuth } from "@/features/auth/hooks/use-auth";
import AuditLogTable from "@/features/reportes/components/audit-log-table";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { ShieldCheckIcon, AlertTriangleIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: AuditoriaComponent,
});

function AuditoriaComponent() {
  const { isAdmin } = useAuth();
  const [entityName, setEntityName] = useState("ALL");
  const [action, setAction] = useState("ALL");

  const { data: logs = [], isLoading } = useAuditLogs({
    entity_name: entityName,
    action,
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-12 bg-slate-900/20 border border-slate-800 rounded-3xl p-6 max-w-xl mx-auto">
        <AlertTriangleIcon className="size-10 mx-auto text-rose-500 mb-2" />
        <p className="text-slate-200 text-base font-bold">Acceso Restringido</p>
        <p className="text-slate-400 text-xs mt-1">
          Solo los usuarios con el rol de Administrador cuentan con autorización para realizar auditorías forenses sobre las operaciones transaccionales.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheckIcon className="size-6 text-indigo-400" />
          Bitácora de Auditoría Forense
        </h2>
        <p className="text-sm text-slate-400">
          Registro inmutable de solo lectura para el rastreo y control forense de cambios transaccionales
        </p>
      </div>

      {/* Controles de Filtrado de Auditoría */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md">
        {/* Entidad */}
        <div className="space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Filtrar por Entidad</span>
          <Select value={entityName} onValueChange={(val) => setEntityName(val || "ALL")}>
            <SelectTrigger className="bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
              <SelectValue placeholder="Todas las entidades" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
              <SelectItem value="ALL">Todas las entidades</SelectItem>
              <SelectItem value="Machine">Maquinarias</SelectItem>
              <SelectItem value="MaintenanceOrder">Órdenes de Trabajo</SelectItem>
              <SelectItem value="SparePart">Repuestos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Acción */}
        <div className="space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-1">Filtrar por Operación</span>
          <Select value={action} onValueChange={(val) => setAction(val || "ALL")}>
            <SelectTrigger className="bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
              <SelectValue placeholder="Todas las acciones" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
              <SelectItem value="ALL">Todas las operaciones</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla de logs de auditoría */}
      <div className="pt-2">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 rounded-xl bg-slate-800/40" />
            <Skeleton className="h-44 rounded-xl bg-slate-800/45" />
          </div>
        ) : (
          <AuditLogTable logs={logs} />
        )}
      </div>
    </div>
  );
}
