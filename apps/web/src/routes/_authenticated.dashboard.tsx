import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useFleetStatus, useMachines } from "@/features/maquinaria/hooks/use-machines";
import FleetStatusChart from "@/features/maquinaria/components/fleet-status-chart";
import { useOrders } from "@/features/mantenimiento/hooks/use-maintenance";
import { useSpareParts } from "@/features/repuestos/hooks/use-spare-parts";
import { Card, CardContent } from "@mantainer-system/ui/components/card";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import {
  CpuIcon,
  WrenchIcon,
  PackageIcon,
  ClipboardListIcon,
  ArrowRightIcon,
  TrendingUpIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardComponent,
});

// ── Componente reutilizable para métricas ──────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  iconClass: string;
}

function MetricCard({ label, value, subtitle, icon: Icon, iconClass }: MetricCardProps) {
  return (
    <Card className="border-border bg-card rounded-2xl">
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 w-full">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
          <p className="font-mono text-2xl font-extrabold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground/70 truncate">{subtitle}</p>
        </div>
        <div className={cn("p-3 rounded-xl shrink-0 w-full", iconClass)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Componente reutilizable para módulos de acceso rápido ──────────────────────
interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  linkTo: string;
  linkLabel: string;
  hoverClass: string;
}

function ModuleCard({ title, description, icon: Icon, iconClass, linkTo, linkLabel, hoverClass }: ModuleCardProps) {
  return (
    <Card className={cn("group flex flex-col border-border bg-card transition-all duration-300 rounded-2xl hover:border-opacity-60", hoverClass)}>
      <CardContent className="p-5 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-xl", iconClass)}>
            <Icon className="size-4" />
          </div>
          <p className="text-sm font-bold text-foreground">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>
        <Link
          to={linkTo as any}
          className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline mt-auto"
        >
          {linkLabel}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Dashboard principal ────────────────────────────────────────────────────────
function DashboardComponent() {
  const {
    user,
    roleLabel,
    canViewReports,
    canViewInventory,
    canManageInventory,
    isWarehouse,
  } = useAuth();

  // Almacén también consulta maquinaria y OTs en modo lectura (spec 2.3): los
  // contadores globales del dashboard deben reflejar datos reales para su rol.
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: spareParts = [], isLoading: partsLoading } = useSpareParts(
    undefined,
    { enabled: canViewInventory },
  );
  // Estado de la flota en % calculado por el backend (spec 4.3).
  const { data: fleetStatus, isLoading: fleetLoading } = useFleetStatus();

  const activeMachines = machines.filter((m) => m.status === "ACTIVA").length;
  const inMaintenance = machines.filter((m) => m.status === "EN_MANTENIMIENTO").length;
  const pendingOrders = orders.filter((o) => o.status === "PROGRAMADO").length;
  const executingOrders = orders.filter((o) => o.status === "EN_EJECUCION").length;
  const lowStockParts = spareParts.filter((p) => p.stock_current <= p.stock_minimum).length;

  const isLoading = machinesLoading || ordersLoading || partsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg bg-default/50" />
          <Skeleton className="h-4 w-72 rounded bg-default/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl bg-default/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl bg-default/50" />
          ))}
        </div>
      </div>
    );
  }

  // Definición de métricas como datos
  const metrics: MetricCardProps[] = [
    {
      label: "Activos en Taller",
      value: machines.length,
      subtitle: `${activeMachines} Activos · ${inMaintenance} Mantenimiento`,
      icon: TruckIcon,
      iconClass: "bg-accent/10 border border-accent/20 text-accent",
    },
    {
      label: "Órdenes Programadas",
      value: pendingOrders,
      subtitle: "Intervenciones técnicas en espera",
      icon: ClipboardListIcon,
      iconClass: "bg-amber-500/10 border border-amber-500/20 text-amber-400",
    },
    {
      label: "Mantenimientos Activos",
      value: executingOrders,
      subtitle: "Trabajos ejecutándose en caliente",
      icon: WrenchIcon,
      iconClass: "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400",
    },
    // spec 3.2: la métrica de bajo stock NO se muestra al Mecánico. El
    // Planificador y Almacén son quienes reponen inventario.
    ...(canManageInventory || isWarehouse
      ? [
          {
            label: "Alertas de Stock",
            value: lowStockParts,
            subtitle: "Repuestos por debajo del mínimo",
            icon: PackageIcon,
            iconClass: "bg-rose-500/10 border border-rose-500/20 text-rose-400",
          } satisfies MetricCardProps,
        ]
      : []),
  ];

  // Definición de módulos como datos
  const modules: ModuleCardProps[] = [
    {
      title: "Catálogo de Maquinarias",
      description: "Visualiza la flota de activos, actualiza horómetros e inspecciona historiales técnicos.",
      icon: CpuIcon,
      iconClass: "bg-accent/10 text-accent",
      linkTo: "/maquinaria",
      linkLabel: "Ingresar al catálogo",
      hoverClass: "hover:border-accent/30",
    },
    {
      title: "Flujo de Mantenimientos",
      description: "Controla el tablero de órdenes de trabajo o ejecuta reparaciones como mecánico.",
      icon: WrenchIcon,
      iconClass: "bg-amber-500/10 text-amber-400",
      linkTo: "/mantenimiento",
      linkLabel: "Abrir tablero de OTs",
      hoverClass: "hover:border-amber-500/30",
    },
    ...(canViewReports
      ? [
          {
            title: "Analítica y Reportes",
            description: "Gastos por activo, repuestos más usados e índice de averías, con filtros anuales, mensuales y semanales.",
            icon: TrendingUpIcon,
            iconClass: "bg-cyan-500/10 text-cyan-400",
            linkTo: "/reportes",
            linkLabel: "Ver reportes analíticos",
            hoverClass: "hover:border-cyan-500/30",
          } satisfies ModuleCardProps,
        ]
      : []),
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Bienvenida */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Hola, {user?.name || "Técnico"}
        </h2>
        <p className="text-muted-foreground text-sm font-medium">
          Centro operativo del taller · Rol:{" "}
          <span className="text-foreground font-bold uppercase">{roleLabel || "Mecánico"}</span>
        </p>
      </div>

      {/* 2. Métricas */}
      <div className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-6",
        metrics.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {/* 3. Estado de la flota en porcentajes, en tiempo real (spec 4.3) */}
      {!isWarehouse && (
        <FleetStatusChart data={fleetStatus} isLoading={fleetLoading} />
      )}

      {/* 4. Módulos de acceso rápido */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Acciones y Módulos</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <ModuleCard key={mod.title} {...mod} />
          ))}
        </div>
      </div>
    </div>
  );
}
