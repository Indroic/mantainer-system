import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@mantainer-system/ui/components/dropdown-menu";
import { BellIcon, AlertTriangleIcon, WrenchIcon, CheckCircle2Icon } from "lucide-react";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import { useSpareParts } from "@/features/repuestos/hooks/use-spare-parts";
import { cn } from "@mantainer-system/ui/lib/utils";

export default function NotificationCenter() {
  const { data: machines = [] } = useMachines();
  const { data: spareParts = [] } = useSpareParts();

  // Generar notificaciones en caliente
  const notifications: {
    id: string;
    type: "STOCK_BAJO" | "MANTENIMIENTO_CERCANO";
    title: string;
    message: string;
    severity: "MEDIUM" | "HIGH";
  }[] = [];

  // 1. Alertas de inventario
  spareParts.forEach((part) => {
    if (part.stock_current <= part.stock_minimum) {
      notifications.push({
        id: `stock-${part.id}`,
        type: "STOCK_BAJO",
        title: "Stock de Repuesto Crítico",
        message: `El repuesto "${part.name}" (${part.code}) cuenta con ${part.stock_current} unidades (Mínimo requerido: ${part.stock_minimum}).`,
        severity: "HIGH",
      });
    }
  });

  // 2. Alertas de maquinaria preventiva
  machines.forEach((machine) => {
    if (machine.status === "DADA_DE_BAJA") return;

    // Supongamos que el ciclo de mantenimiento preventivo es cada 250 horas
    const nextMaintenance = Math.ceil(machine.current_horometer / 250) * 250;
    const hoursLeft = nextMaintenance - machine.current_horometer;

    if (hoursLeft <= 50 && hoursLeft > 0) {
      notifications.push({
        id: `maint-cercano-${machine.id}`,
        type: "MANTENIMIENTO_CERCANO",
        title: "Mantenimiento Preventivo Cercano",
        message: `La maquinaria ${machine.code} está a ${hoursLeft.toFixed(1)} hrs de su mantenimiento de ${nextMaintenance} hrs.`,
        severity: "MEDIUM",
      });
    }
  });

  const hasNotifications = notifications.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 transition-all duration-200">
          <BellIcon className={cn("size-5 text-slate-300", hasNotifications && "animate-none")} />
          {hasNotifications && (
            <>
              <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500" />
              <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 animate-ping" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-slate-900 border border-slate-800 text-slate-100 p-2 rounded-2xl shadow-xl z-50">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            Alertas Activas del Taller
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuGroup className="max-h-80 overflow-y-auto space-y-1.5 p-1">
          {!hasNotifications ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
              <CheckCircle2Icon className="size-8 text-emerald-500/80 mb-2 animate-bounce" />
              <p className="text-xs font-semibold">Taller en condiciones óptimas</p>
              <p className="text-[10px] opacity-85">No hay alertas de inventario ni de maquinaria</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={cn(
                  "flex gap-3 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium focus:bg-slate-800 focus:text-slate-100",
                  notif.severity === "HIGH"
                    ? "bg-rose-950/20 border-rose-900/30 text-slate-200"
                    : "bg-amber-950/20 border-amber-900/30 text-slate-200"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {notif.type === "STOCK_BAJO" ? (
                    <AlertTriangleIcon className="size-4.5 text-rose-400" />
                  ) : (
                    <WrenchIcon className="size-4.5 text-amber-400" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className={cn(
                    "text-[10px] font-extrabold uppercase tracking-wide",
                    notif.severity === "HIGH" ? "text-rose-400" : "text-amber-400"
                  )}>
                    {notif.title}
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-300 opacity-90">{notif.message}</p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
