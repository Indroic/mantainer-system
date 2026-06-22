import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@mantainer-system/ui/components/card";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mantainer-system/ui/components/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@mantainer-system/ui/components/dialog";
import {
  WrenchIcon,
  PlayIcon,
  CheckCircleIcon,
  PackagePlusIcon,
  AlertTriangleIcon,
  GaugeIcon,
  ClipboardListIcon,
  CoinsIcon,
} from "lucide-react";
import { useState } from "react";
import { useStartOrder, useAddSparePartToOrder, useLiquidateOrder } from "../hooks/use-maintenance";
import { useSpareParts } from "@/features/repuestos/hooks/use-spare-parts";
import type { MaintenanceOrderResponse } from "../types";
import type { SparePartResponse } from "@/features/repuestos/types";
import { toast } from "sonner";
import { cn } from "@mantainer-system/ui/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";

interface ExecutionPanelProps {
  order: MaintenanceOrderResponse;
}

export default function ExecutionPanel({ order }: ExecutionPanelProps) {
  const { isAdmin, isSupervisor } = useAuth();
  const canSeeFinancials = isAdmin || isSupervisor;
  // Queries y Mutaciones
  const startMutation = useStartOrder(order.id);
  const addSparePartMutation = useAddSparePartToOrder(order.id);
  const liquidateMutation = useLiquidateOrder(order.id);

  // Estados locales
  const [sparePartSearch, setSparePartSearch] = useState("");
  const { data: spareParts = [] } = useSpareParts(sparePartSearch);

  const [selectedPart, setSelectedPart] = useState<SparePartResponse | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [horometerInput, setHorometerInput] = useState<number>(order.machine?.current_horometer || 0);
  const [liquidateDialogOpen, setLiquidateDialogOpen] = useState(false);

  // Validaciones locales
  const isPartOutOfStock = selectedPart ? quantity > selectedPart.stock_current : false;
  const isHorometerInvalid = horometerInput < (order.machine?.current_horometer || 0);

  const handleStart = async () => {
    await startMutation.mutateAsync();
  };

  const handleAddSparePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    if (isPartOutOfStock) {
      toast.error("La cantidad supera el stock físico disponible");
      return;
    }

    await addSparePartMutation.mutateAsync(
      {
        spare_part_id: selectedPart.id,
        quantity,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedPart(null);
          setQuantity(1);
        },
      }
    );
  };

  const handleLiquidate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isHorometerInvalid) {
      toast.error("El horómetro de cierre debe ser igual o mayor al actual");
      return;
    }

    await liquidateMutation.mutateAsync(
      {
        current_horometer: horometerInput,
      },
      {
        onSuccess: () => {
          setLiquidateDialogOpen(false);
        },
      }
    );
  };

  // Calcular costo acumulado total de repuestos consumidos en esta orden
  const totalCost = order.spare_parts.reduce(
    (acc, item) => acc + item.quantity * item.unit_cost_at_time,
    0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ========================================================================= */}
      {/* PANEL IZQUIERDO: DETALLE DE LA ORDEN & CONTROL DE FLUJO                   */}
      {/* ========================================================================= */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-2xl">
          <CardHeader className="border-b border-slate-800/60 pb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-xs font-bold text-indigo-400">OT PORTAL</span>
              <Badge
                className={cn(
                  "px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase",
                  order.status === "PROGRAMADO" && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                  order.status === "EN_EJECUCION" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                  order.status === "LIQUIDADO" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                )}
              >
                {order.status}
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold text-slate-100">{order.description}</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Creada el {new Date(order.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Información Técnica de Maquinaria */}
            <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/40">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalle del Activo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Código</p>
                  <p className="text-sm font-bold text-slate-200">{order.machine?.code}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Marca / Modelo</p>
                  <p className="text-sm text-slate-300 font-medium">
                    {order.machine?.brand} {order.machine?.model}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Horómetro Actual</p>
                  <p className="text-sm font-mono font-bold text-indigo-400">
                    {order.machine?.current_horometer} hrs
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Estado Actual</p>
                  <Badge variant="outline" className="text-[9px] rounded-lg mt-0.5 border-slate-700/60 text-slate-300 bg-slate-800/40 font-bold uppercase">
                    {order.machine?.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Controles de Flujo de Trabajo */}
            <div className="pt-4 border-t border-slate-850 space-y-3">
              {order.status === "PROGRAMADO" && (
                <Button
                  onClick={handleStart}
                  disabled={startMutation.isPending}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white flex items-center justify-center gap-2"
                >
                  <PlayIcon className="size-4" />
                  {startMutation.isPending ? "Iniciando..." : "Iniciar Mantenimiento"}
                </Button>
              )}

              {order.status === "EN_EJECUCION" && (
                <Dialog open={liquidateDialogOpen} onOpenChange={setLiquidateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white flex items-center justify-center gap-2">
                      <CheckCircleIcon className="size-4" />
                      Liquidar y Cerrar OT
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <GaugeIcon className="size-5 text-emerald-400" />
                        Cierre de Orden de Trabajo
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLiquidate} className="space-y-4 mt-2">
                      <div className="space-y-1">
                        <Label htmlFor="horometerInput" className="text-slate-300 text-xs">
                          Horómetro de Cierre de Máquina (hrs)
                        </Label>
                        <Input
                          id="horometerInput"
                          type="number"
                          step="0.1"
                          value={horometerInput}
                          onChange={(e) => setHorometerInput(Number(e.target.value))}
                          className="bg-slate-950/80 border-slate-800 rounded-xl"
                        />
                        <p className="text-[10px] text-slate-500 font-medium">
                          Horómetro actual del activo: {order.machine?.current_horometer} hrs
                        </p>
                      </div>

                      {isHorometerInvalid && (
                        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
                          <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                          <span>
                            El horómetro ingresado es menor al horómetro actual de la máquina ({order.machine?.current_horometer} hrs).
                          </span>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="submit"
                          disabled={liquidateMutation.isPending || isHorometerInvalid}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold"
                        >
                          {liquidateMutation.isPending ? "Liquidando..." : "Confirmar Cierre"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setLiquidateDialogOpen(false)}
                          className="flex-1 rounded-xl border-slate-800 text-slate-300 hover:bg-slate-800"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}

              {order.status === "LIQUIDADO" && (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs flex gap-2 items-center justify-center font-medium">
                  <CheckCircleIcon className="size-4 text-emerald-400 animate-pulse" />
                  <span>Orden Liquidada y Archivada</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* PANEL CENTRAL/DERECHO: CONSUMO DE REPUESTOS Y MATERIALES                  */}
      {/* ========================================================================= */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/60 pb-4">
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <WrenchIcon className="size-5 text-indigo-400" />
                Repuestos Consumidos
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Piezas de recambio asignadas al mantenimiento
              </CardDescription>
            </div>

            {order.status === "EN_EJECUCION" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5">
                    <PackagePlusIcon className="size-4" />
                    Asignar Repuesto
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <PackagePlusIcon className="size-5 text-indigo-400" />
                      Asignar Pieza del Inventario
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddSparePart} className="space-y-4 mt-2">
                    {/* Buscador de repuestos en caliente */}
                    <div className="space-y-1">
                      <Label htmlFor="partSearch" className="text-slate-300 text-xs">
                        Buscar Repuesto (Código o Nombre)
                      </Label>
                      <Input
                        id="partSearch"
                        type="text"
                        placeholder="Ej. Filtro..."
                        value={sparePartSearch}
                        onChange={(e) => setSparePartSearch(e.target.value)}
                        className="bg-slate-950/80 border-slate-800 rounded-xl"
                      />
                    </div>

                    {/* Selector de repuesto encontrado */}
                    <div className="space-y-1">
                      <Label className="text-slate-300 text-xs">Seleccione el Repuesto</Label>
                      <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/40 p-2 space-y-1">
                        {spareParts.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">
                            No se encontraron repuestos.
                          </p>
                        ) : (
                          spareParts.map((part) => (
                            <button
                              key={part.id}
                              type="button"
                              onClick={() => {
                                setSelectedPart(part);
                                setQuantity(1);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-semibold transition-colors",
                                selectedPart?.id === part.id
                                  ? "bg-indigo-600 text-white"
                                  : "hover:bg-slate-800 text-slate-300"
                              )}
                            >
                              <span>
                                {part.name} ({part.code})
                              </span>
                              <span className="font-mono text-[10px] opacity-80">
                                Stock: {part.stock_current}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedPart && (
                      <div className="space-y-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Pieza seleccionada:</span>
                          <span className="font-bold text-slate-100">{selectedPart.name}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Stock disponible:</span>
                          <span className="font-bold font-mono text-slate-100">
                            {selectedPart.stock_current} unidades
                          </span>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="qtyInput" className="text-slate-300 text-xs">
                            Cantidad a Utilizar
                          </Label>
                          <Input
                            id="qtyInput"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="bg-slate-950/80 border-slate-800 rounded-xl"
                          />
                        </div>

                        {/* Bloqueo y Alerta en Rojo si cantidad supera stock disponible */}
                        {isPartOutOfStock && (
                          <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
                            <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                            <span>
                              ¡Advertencia! La cantidad solicitada ({quantity}) supera el stock físico actual ({selectedPart.stock_current}).
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={addSparePartMutation.isPending || !selectedPart || isPartOutOfStock}
                        className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold"
                      >
                        {addSparePartMutation.isPending ? "Asignando..." : "Asignar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        className="flex-1 rounded-xl border-slate-800 text-slate-300 hover:bg-slate-800"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/20">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-400">Código</TableHead>
                    <TableHead className="font-semibold text-slate-400">Descripción</TableHead>
                    <TableHead className="font-semibold text-slate-400 text-right">Cantidad</TableHead>
                    {canSeeFinancials && (
                      <>
                        <TableHead className="font-semibold text-slate-400 text-right">Costo Unit. Hist.</TableHead>
                        <TableHead className="font-semibold text-slate-400 text-right">Subtotal</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.spare_parts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canSeeFinancials ? 5 : 3} className="text-center py-8 text-slate-500 font-medium">
                        No se han asignado repuestos a esta orden de trabajo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    order.spare_parts.map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-850/50 hover:bg-slate-900/10">
                        <TableCell className="font-mono font-bold text-indigo-400">
                          {item.spare_part?.code || "REP-REP"}
                        </TableCell>
                        <TableCell className="font-medium text-slate-200">
                          {item.spare_part?.name || "Repuesto Histórico"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-300">{item.quantity}</TableCell>
                        {canSeeFinancials && (
                          <>
                            <TableCell className="text-right font-mono text-slate-300">
                              ${item.unit_cost_at_time.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-indigo-300">
                              ${(item.quantity * item.unit_cost_at_time).toFixed(2)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Sumatoria de Costos */}
            {canSeeFinancials && (
              <div className="flex justify-between items-center p-4 bg-slate-950/40 rounded-xl border border-slate-800/40">
                <div className="flex items-center gap-2 text-slate-400">
                  <CoinsIcon className="size-4 text-indigo-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Costo Financiero de Repuestos</span>
                </div>
                <span className="font-mono text-lg font-bold text-indigo-400">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
