import { createFileRoute } from "@tanstack/react-router";
import MachineForm from "@/features/maquinaria/components/machine-form";
import { CpuIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/maquinaria/nueva")({
  component: MaquinariaNuevaComponent,
});

function MaquinariaNuevaComponent() {
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
