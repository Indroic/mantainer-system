import { createFileRoute, Link } from "@tanstack/react-router";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import { useAuth } from "@/features/auth/hooks/use-auth";
import MachineCard from "@/features/maquinaria/components/machine-card";
import { Button, buttonVariants } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { PlusIcon, SearchIcon, CpuIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@mantainer-system/ui/lib/utils";

export const Route = createFileRoute("/_authenticated/maquinaria/")({
  component: MaquinariaIndexComponent,
});

function MaquinariaIndexComponent() {
  const { isAdmin, isSupervisor } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const { data: machines = [], isLoading } = useMachines({
    status,
    search,
  });

  const canCreate = isAdmin || isSupervisor;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <CpuIcon className="size-6 text-indigo-400" />
            Flota de Maquinarias
          </h2>
          <p className="text-sm text-slate-400">
            Catálogo completo de activos pesados y su estado operativo
          </p>
        </div>

        {canCreate && (
          <Link
            to="/maquinaria/nueva"
            className={cn(
              buttonVariants({ variant: "default" }),
              "rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/10 h-8 px-4"
            )}
          >
            <PlusIcon className="size-4" />
            Registrar Maquinaria
          </Link>
        )}
      </div>

      {/* Controles de Búsqueda y Filtrado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md">
        {/* Buscador de Texto */}
        <div className="relative sm:col-span-2">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-slate-500" />
          <Input
            type="text"
            placeholder="Buscar por código, marca, modelo o motor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
          />
        </div>

        {/* Filtro por Estado */}
        <div>
          <Select value={status} onValueChange={(val) => setStatus(val || "ALL")}>
            <SelectTrigger className="bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="ACTIVA">Activa</SelectItem>
              <SelectItem value="EN_MANTENIMIENTO">En Mantenimiento</SelectItem>
              <SelectItem value="FUERA_DE_SERVICIO">Fuera de Servicio</SelectItem>
              <SelectItem value="DADA_DE_BAJA">Dada de Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Maquinarias */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-44 rounded-2xl bg-slate-800/50" />
          <Skeleton className="h-44 rounded-2xl bg-slate-800/50" />
          <Skeleton className="h-44 rounded-2xl bg-slate-800/50" />
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-800/80 rounded-3xl p-6">
          <CpuIcon className="size-10 mx-auto text-slate-700 mb-2 animate-bounce" />
          <p className="text-slate-500 text-sm font-semibold">No se encontraron maquinarias pesadas.</p>
          <p className="text-slate-600 text-xs mt-1">Intenta modificar los criterios de búsqueda o filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              canEdit={isAdmin || isSupervisor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
