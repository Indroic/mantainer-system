import { Card, CardHeader, CardTitle, CardContent } from "@mantainer-system/ui/components/card";
import { Badge } from "@mantainer-system/ui/components/badge";
import { buttonVariants } from "@mantainer-system/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { MaintenanceOrderResponse, OrderStatus } from "../types";
import { ClipboardListIcon, CalendarIcon, UserIcon, ArrowRightIcon, CpuIcon } from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";

interface KanbanBoardProps {
  orders: MaintenanceOrderResponse[];
}

export default function KanbanBoard({ orders }: KanbanBoardProps) {
  const columns: { status: OrderStatus; label: string; className: string }[] = [
    {
      status: "PROGRAMADO",
      label: "Programado",
      className: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400",
    },
    {
      status: "EN_EJECUCION",
      label: "En Ejecución",
      className: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    },
    {
      status: "LIQUIDADO",
      label: "Liquidado",
      className: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    },
  ];

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter((order) => order.status === status);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const styles: Record<OrderStatus, string> = {
      PROGRAMADO: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      EN_EJECUCION: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      LIQUIDADO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
    return (
      <Badge className={cn("px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase", styles[status])}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="w-full">
      {/* ========================================================================= */}
      {/* 1. VISTA MÓVIL (Mobile-First, visible < md): Lista vertical interactiva  */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-10 bg-surface/20 border border-border rounded-2xl p-6">
            <ClipboardListIcon className="size-8 mx-auto text-slate-600 mb-2" />
            <p className="text-muted-foreground text-sm font-medium">No hay órdenes de trabajo registradas.</p>
          </div>
        ) : (
          orders.map((order) => (
            <Card
              key={order.id}
              className="bg-surface/20 border-border rounded-2xl p-4 transition-all duration-200 active:scale-[0.99]"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <CpuIcon className="size-4 text-indigo-400" />
                  <span className="font-mono font-bold text-foreground">{order.machine?.code || "Maquinaria"}</span>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <p className="text-sm font-medium text-foreground mb-4 line-clamp-2">{order.description}</p>

              <div className="flex flex-col gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <UserIcon className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{order.assigned_mechanic_name || "Mecánico Asignado"}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <Link
                  to="/mantenimiento/$id"
                  params={{ id: order.id }}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1"
                  )}
                >
                  Abrir Orden
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. VISTA ESCRITORIO (Visible >= md): Tablero Kanban estructurado          */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {columns.map((column) => {
          const colOrders = getOrdersByStatus(column.status);

          return (
            <div
              key={column.status}
              className="flex flex-col h-[70vh] rounded-2xl border border-border bg-surface/20 p-4"
            >
              {/* Encabezado de Columna */}
              <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{column.label}</span>
                  <Badge className="bg-default/60 text-muted font-mono text-[10px] rounded-lg px-2 border-border">
                    {colOrders.length}
                  </Badge>
                </div>
              </div>

              {/* Contenedor de Tarjetas de Columna */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {colOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-xl p-4 text-center">
                    <p className="text-xs text-muted">Sin órdenes en esta columna</p>
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="group relative overflow-hidden bg-surface/50 hover:bg-surface border-border hover:border-accent/30 transition-all duration-300 rounded-xl flex flex-col justify-between"
                    >
                      <CardHeader className="p-4 pb-2 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-accent flex items-center gap-1.5">
                            <CpuIcon className="size-3.5" />
                            {order.machine?.code}
                          </span>
                          <span className="text-[10px] text-muted">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        <CardTitle className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                          {order.description}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 pb-3">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <UserIcon className="size-3.5 text-muted/80" />
                          <span className="truncate">{order.assigned_mechanic_name || "Mecánico Asignado"}</span>
                        </div>
                      </CardContent>
                      <div className="px-4 py-3 bg-default/40 border-t border-border flex justify-end mt-auto">
                        <Link
                          to="/mantenimiento/$id"
                          params={{ id: order.id }}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "rounded-lg text-accent hover:text-accent-foreground hover:bg-accent/20 h-7 text-xs flex items-center gap-1"
                          )}
                        >
                          Ejecutar Trabajo
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
