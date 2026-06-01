import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import { useOrders } from "@/features/mantenimiento/hooks/use-maintenance";
import { useSpareParts } from "@/features/repuestos/hooks/use-spare-parts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@mantainer-system/ui/components/card";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import {
  CpuIcon,
  WrenchIcon,
  PackageIcon,
  ShieldCheckIcon,
  ClipboardListIcon,
  ArrowRightIcon,
  TrendingUpIcon,
  UserIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user, role, isAdmin, isSupervisor } = useAuth();
  
  // Consultar caches de forma optimizada
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: spareParts = [], isLoading: partsLoading } = useSpareParts();

  const activeMachines = machines.filter((m) => m.status === "ACTIVA").length;
  const inMaintenance = machines.filter((m) => m.status === "EN_MANTENIMIENTO").length;
  const inactiveMachines = machines.filter((m) => m.status === "FUERA_DE_SERVICIO").length;

  const pendingOrders = orders.filter((o) => o.status === "PROGRAMADO").length;
  const executingOrders = orders.filter((o) => o.status === "EN_EJECUCION").length;

  const lowStockParts = spareParts.filter((p) => p.stock_current <= p.stock_minimum).length;

  const isLoading = machinesLoading || ordersLoading || partsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-28 rounded bg-slate-800" />
          <Skeleton className="h-28 rounded bg-slate-800" />
          <Skeleton className="h-28 rounded bg-slate-800" />
          <Skeleton className="h-28 rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Mensaje de Bienvenida */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Hola, {user?.name || "Técnico"}
        </h2>
        <p className="text-slate-400 text-sm font-medium">
          Bienvenido al centro operativo del taller. Rol: <span className="text-slate-200 uppercase font-bold">{role || "Mecánico"}</span>
        </p>
      </div>

      {/* 2. Grid de Métricas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-800/85 bg-slate-900/40 backdrop-blur-md rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Activos en Taller</p>
              <p className="font-mono text-2xl font-extrabold text-slate-100">{machines.length}</p>
              <p className="text-[10px] text-slate-400">{activeMachines} Activos · {inMaintenance} Mantenimiento</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
              <CpuIcon className="size-5.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/85 bg-slate-900/40 backdrop-blur-md rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Órdenes Programadas</p>
              <p className="font-mono text-2xl font-extrabold text-slate-100">{pendingOrders}</p>
              <p className="text-[10px] text-slate-400">Intervenciones técnicas en espera</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400">
              <ClipboardListIcon className="size-5.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/85 bg-slate-900/40 backdrop-blur-md rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mantenimientos Activos</p>
              <p className="font-mono text-2xl font-extrabold text-slate-100">{executingOrders}</p>
              <p className="text-[10px] text-slate-400">Trabajos ejecutándose en caliente</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400">
              <WrenchIcon className="size-5.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/85 bg-slate-900/40 backdrop-blur-md rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Alertas de Stock</p>
              <p className="font-mono text-2xl font-extrabold text-slate-100">{lowStockParts}</p>
              <p className="text-[10px] text-slate-400">Repuestos por debajo del mínimo</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400">
              <PackageIcon className="size-5.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Panel de Accesos Rápidos */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Acciones y Módulos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Módulo Maquinaria */}
          <Card className="group border-slate-800/80 bg-slate-900/30 hover:bg-slate-900 hover:border-indigo-500/30 transition-all duration-300 rounded-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CpuIcon className="size-5 text-indigo-400" />
                Catálogo de Maquinarias
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 leading-relaxed">
                Visualiza la flota de activos, actualiza horómetros en caliente e inspecciona historiales.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Link
                to="/maquinaria"
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-200"
              >
                Ingresar al catálogo
                <ArrowRightIcon className="size-4" />
              </Link>
            </CardContent>
          </Card>

          {/* Módulo Mantenimiento */}
          <Card className="group border-slate-800/80 bg-slate-900/30 hover:bg-slate-900 hover:border-indigo-500/30 transition-all duration-300 rounded-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                <WrenchIcon className="size-5 text-amber-400" />
                Flujo de Mantenimientos
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 leading-relaxed">
                Controla el tablero de órdenes de trabajo del taller o ejecuta reparaciones como mecánico.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Link
                to="/mantenimiento"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-200"
              >
                Abrir tablero de OTs
                <ArrowRightIcon className="size-4" />
              </Link>
            </CardContent>
          </Card>

          {/* Módulos Administrativos */}
          {(isAdmin || isSupervisor) && (
            <Card className="group border-slate-800/80 bg-slate-900/30 hover:bg-slate-900 hover:border-indigo-500/30 transition-all duration-300 rounded-2xl">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUpIcon className="size-5 text-cyan-400" />
                  Informes Financieros
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Inspecciona la inversión de repuestos por activo o gestiona el inventario físico del almacén.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <Link
                  to="/reportes"
                  className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-200"
                >
                  Ver reportes financieros
                  <ArrowRightIcon className="size-4" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
