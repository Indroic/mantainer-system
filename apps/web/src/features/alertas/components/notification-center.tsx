import { useMemo } from "react";
import { Popover } from "@heroui/react";
import { BellIcon, AlertTriangleIcon, WrenchIcon, CheckCircle2Icon } from "lucide-react";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import { useSpareParts } from "@/features/repuestos/hooks/use-spare-parts";
import { cn } from "@mantainer-system/ui/lib/utils";

export default function NotificationCenter() {
  const { data: machines = [] } = useMachines();
  const { data: spareParts = [] } = useSpareParts();

  // Pattern #1: Compute Derived Values During Render (useMemo for array iteration)
  const notifications = useMemo(() => {
    const list: {
      id: string;
      type: "STOCK_BAJO" | "MANTENIMIENTO_CERCANO";
      title: string;
      message: string;
      severity: "MEDIUM" | "HIGH";
    }[] = [];

    // 1. Alertas de inventario
    spareParts.forEach((part) => {
      if (part.stock_current <= part.stock_minimum) {
        list.push({
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

      const nextMaintenance = Math.ceil(machine.current_horometer / 250) * 250;
      const hoursLeft = nextMaintenance - machine.current_horometer;

      if (hoursLeft <= 50 && hoursLeft > 0) {
        list.push({
          id: `maint-cercano-${machine.id}`,
          type: "MANTENIMIENTO_CERCANO",
          title: "Mantenimiento Preventivo Cercano",
          message: `La maquinaria ${machine.code} está a ${hoursLeft.toFixed(1)} hrs de su mantenimiento de ${nextMaintenance} hrs.`,
          severity: "MEDIUM",
        });
      }
    });

    return list;
  }, [spareParts, machines]);

  const hasNotifications = notifications.length > 0;

  return (
    <Popover placement="bottom end">
      <Popover.Trigger>
        <button className="relative p-2 rounded-xl bg-default/60 hover:bg-default border border-border transition-colors text-muted hover:text-foreground">
          <BellIcon className={cn("size-5", hasNotifications && "text-accent")} />
          {hasNotifications && (
            <>
              <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500" />
              <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 animate-ping" />
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content className="w-80 bg-background border border-border text-foreground p-3 rounded-2xl shadow-xl z-50">
        <div className="px-2 py-1 text-xs font-bold text-muted uppercase tracking-wider">
          Alertas Activas del Taller
        </div>
        <div className="h-px bg-border my-2" />
        <div className="max-h-80 overflow-y-auto space-y-2 p-1">
          {!hasNotifications ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted">
              <CheckCircle2Icon className="size-8 text-emerald-500 mb-2 animate-bounce" />
              <p className="text-xs font-semibold text-foreground">Taller en condiciones óptimas</p>
              <p className="text-[10px] opacity-80">No hay alertas de inventario ni de maquinaria</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "flex gap-3 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium",
                  notif.severity === "HIGH"
                    ? "bg-rose-500/10 border-rose-500/20 text-foreground"
                    : "bg-amber-500/10 border-amber-500/20 text-foreground"
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
                  <p className="text-[11px] leading-relaxed text-muted">{notif.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
}
