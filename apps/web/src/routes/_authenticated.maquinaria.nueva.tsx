import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import MachineForm from "@/features/maquinaria/components/machine-form";
import { CpuIcon, AlertTriangleIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/maquinaria/nueva")({
  component: MaquinariaNuevaComponent,
});

function MaquinariaNuevaComponent() {
  const { isAdmin, isSupervisor } = useAuth();

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="text-center py-12 bg-slate-900/20 border border-slate-800 rounded-3xl p-6 max-w-xl mx-auto">
        <AlertTriangleIcon className="size-10 mx-auto text-rose-500 mb-2" />
        <p className="text-slate-200 text-base font-bold">Acceso Restringido</p>
        <p className="text-slate-400 text-xs mt-1">
          No cuenta con privilegios suficientes para registrar nuevos activos en la flota de maquinaria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <CpuIcon className="size-6 text-indigo-400" />
          Registrar Nueva Maquinaria
        </h2>
        <p className="text-sm text-slate-400">
          Inscribe un nuevo activo pesado al inventario del taller operativo
        </p>
      </div>

      <div className="pt-2">
        <MachineForm />
      </div>
    </div>
  );
}
