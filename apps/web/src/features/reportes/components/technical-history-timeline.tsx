import { Badge } from "@mantainer-system/ui/components/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@mantainer-system/ui/components/card";
import { WrenchIcon, CalendarIcon, CoinsIcon, GaugeIcon, ClipboardListIcon } from "lucide-react";
import type { MaintenanceOrderResponse } from "@/features/mantenimiento/types";

interface TechnicalHistoryTimelineProps {
  orders: MaintenanceOrderResponse[];
}

export default function TechnicalHistoryTimeline({ orders }: TechnicalHistoryTimelineProps) {
  const liquidatedOrders = orders
    .filter((order) => order.status === "LIQUIDADO")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (liquidatedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/20 border border-slate-800 rounded-2xl text-center">
        <ClipboardListIcon className="size-8 text-slate-600 mb-2 animate-pulse" />
        <p className="text-slate-500 text-sm font-semibold">Sin registros en la bitácora técnica de mantenimientos.</p>
        <p className="text-slate-600 text-xs mt-1">Las órdenes liquidadas se indexarán en esta línea de tiempo.</p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-slate-800/80 ml-4 md:ml-6 pl-6 md:pl-8 space-y-8 py-2">
      {liquidatedOrders.map((order) => {
        const orderPartsCost = order.spare_parts.reduce(
          (acc, item) => acc + item.quantity * item.unit_cost_at_time,
          0
        );

        return (
          <div key={order.id} className="relative group">
            {/* Círculo brillante indicador de línea de tiempo */}
            <span className="absolute -left-[31px] md:-left-[39px] top-1.5 flex size-6 items-center justify-center rounded-full bg-slate-950 border border-slate-800 group-hover:border-indigo-500 transition-all duration-300">
              <span className="size-2 rounded-full bg-indigo-500 animate-pulse" />
            </span>

            {/* Contenedor Principal de la Tarjeta */}
            <Card className="bg-slate-900/40 border-slate-800/80 hover:border-indigo-500/30 transition-all duration-300 rounded-2xl overflow-hidden shadow-xl">
              <CardHeader className="p-4 pb-2 border-b border-slate-800/40 bg-slate-950/20 flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <WrenchIcon className="size-4 text-indigo-400" />
                    <CardTitle className="text-sm font-bold text-slate-100">{order.description}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <CalendarIcon className="size-3 text-slate-500" />
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg px-2 py-0.5 font-bold uppercase text-[9px]">
                  Completado
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Repuestos consumidos */}
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Repuestos Reemplazados</p>
                  {order.spare_parts.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No se consumieron repuestos en esta intervención.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/40">
                      <table className="w-full text-xs font-medium text-left">
                        <thead>
                          <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 text-[10px] uppercase font-bold">
                            <th className="px-3 py-1.5">Código</th>
                            <th className="px-3 py-1.5">Nombre</th>
                            <th className="px-3 py-1.5 text-right">Cantidad</th>
                            <th className="px-3 py-1.5 text-right font-mono">Costo Unit. Hist.</th>
                            <th className="px-3 py-1.5 text-right font-mono">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/50">
                          {order.spare_parts.map((item) => (
                            <tr key={item.id} className="text-slate-300">
                              <td className="px-3 py-2 font-mono font-bold text-indigo-400">{item.spare_part?.code}</td>
                              <td className="px-3 py-2 font-semibold text-slate-200">{item.spare_part?.name}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-300">{item.quantity}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-400">${item.unit_cost_at_time.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-indigo-300">${(item.quantity * item.unit_cost_at_time).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Resumen de Costos y Cierre */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl gap-3">
                  <div className="flex items-center gap-2">
                    <CoinsIcon className="size-4 text-indigo-400 animate-pulse" />
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Costo Financiero Asociado</p>
                      <p className="text-sm font-bold font-mono text-indigo-300">${orderPartsCost.toFixed(2)}</p>
                    </div>
                  </div>
                  {order.next_service_horometer && (
                    <div className="flex items-center gap-2">
                      <GaugeIcon className="size-4 text-amber-400" />
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Próximo Servicio Recomendado</p>
                        <p className="text-sm font-bold font-mono text-amber-400">{order.next_service_horometer} hrs</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
