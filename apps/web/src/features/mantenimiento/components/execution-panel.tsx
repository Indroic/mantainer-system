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
  CoinsIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  FileTextIcon,
  PackageCheckIcon,
  Undo2Icon,
} from "lucide-react";
import { useState } from "react";
import { useStartOrder, useAddSparePartToOrder, useLiquidateOrder, useReturnSparePart } from "../hooks/use-maintenance";
import { useDispatchSolvency, useDownloadSolvencyPdf } from "../hooks/use-solvencies";
import { useSpareParts } from "@/features/repuestos/hooks/use-spare-parts";
import { failureCategoryLabel, type MaintenanceOrderResponse, type SolvencyResponse } from "../types";
import {
  formatCurrency,
  orderSpareParts,
  orderSparePartsTotal,
  sparePartQuantity,
  sparePartUnitCost,
} from "../utils/order-costs";
import type { SparePartResponse } from "@/features/repuestos/types";
import { toast } from "sonner";
import { cn } from "@mantainer-system/ui/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { horometerNoun, horometerUnitAbbr } from "@/features/maquinaria/types";

interface ExecutionPanelProps {
  order: MaintenanceOrderResponse;
}

export default function ExecutionPanel({ order }: ExecutionPanelProps) {
  const {
    canViewFinancials,
    canAssignSpareParts,
    canViewSolvencies,
    canDispatchSolvencies,
  } = useAuth();
  const canSeeFinancials = canViewFinancials;

  // Queries y Mutaciones
  const startMutation = useStartOrder(order.id);
  const addSparePartMutation = useAddSparePartToOrder(order.id);
  const liquidateMutation = useLiquidateOrder(order.id);
  const returnSparePartMutation = useReturnSparePart(order.id);
  const downloadSolvency = useDownloadSolvencyPdf();
  const dispatchSolvency = useDispatchSolvency();

  // Las solvencias llegan embebidas en la OT; nunca se itera la respuesta cruda.
  const solvencies: SolvencyResponse[] = Array.isArray(order.solvencies)
    ? order.solvencies
    : [];

  // Estados locales
  const [sparePartSearch, setSparePartSearch] = useState("");
  const { data: sparePartsData, isLoading: sparePartsLoading, isError: sparePartsError } =
    useSpareParts(sparePartSearch);
  // El backend puede devolver `null` (o un error) en lugar de una lista: nunca
  // iteramos directamente sobre la respuesta cruda.
  const spareParts: SparePartResponse[] = Array.isArray(sparePartsData) ? sparePartsData : [];

  const [selectedPart, setSelectedPart] = useState<SparePartResponse | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const horometerUnit = order.machine?.horometer_unit;
  const horometerLabel = horometerNoun(horometerUnit);
  const horometerAbbr = horometerUnitAbbr(horometerUnit);

  const [horometerInput, setHorometerInput] = useState<number>(order.machine?.current_horometer || 0);
  const [liquidateDialogOpen, setLiquidateDialogOpen] = useState(false);
  // spec 5.1: descripción detallada del trabajo realizado, obligatoria antes de
  // liquidar y cerrar la OT. Queda en el historial del activo.
  const [workPerformed, setWorkPerformed] = useState<string>(order.work_performed ?? "");

  const trimmedWorkPerformed = workPerformed.trim();
  const isWorkPerformedInvalid = trimmedWorkPerformed.length < 10;

  // Validaciones locales
  const selectedPartStock = Number(selectedPart?.stock_current ?? 0);
  const isPartOutOfStock = selectedPart ? quantity > selectedPartStock : false;
  const isHorometerInvalid = horometerInput < (order.machine?.current_horometer || 0);

  const handleStart = async () => {
    await startMutation.mutateAsync(undefined);
  };

  const handleAddSparePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart?.id) {
      toast.error("Seleccione un repuesto del inventario antes de asignar");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Indique una cantidad válida (mínimo 1 unidad)");
      return;
    }

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

    if (isWorkPerformedInvalid) {
      toast.error(
        "Describa el trabajo realizado (mínimo 10 caracteres) antes de liquidar la OT",
      );
      return;
    }

    await liquidateMutation.mutateAsync(
      {
        current_horometer: horometerInput,
        work_performed: trimmedWorkPerformed,
      },
      {
        onSuccess: () => {
          setLiquidateDialogOpen(false);
        },
      }
    );
  };

  // Repuestos ya asignados. `unit_cost_at_time` llega en `null` hasta que la OT
  // se liquida, así que todo el cálculo pasa por los helpers defensivos.
  const assignedParts = orderSpareParts(order);
  const totalCost = orderSparePartsTotal(order);
  const hasEstimatedCosts = assignedParts.some((item) => !sparePartUnitCost(item).isHistorical);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ========================================================================= */}
      {/* PANEL IZQUIERDO: DETALLE DE LA ORDEN & CONTROL DE FLUJO                   */}
      {/* ========================================================================= */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-border bg-surface/20 backdrop-blur-md rounded-2xl">
          <CardHeader className="border-b border-border pb-4">
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
            <CardTitle className="text-xl font-bold text-foreground">{order.description}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Creada el {new Date(order.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Información Técnica de Maquinaria */}
            <div className="space-y-3 bg-background/80 p-4 rounded-xl border border-border">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Detalle del Activo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Código</p>
                  <p className="text-sm font-bold text-foreground">{order.machine?.code}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Marca / Modelo</p>
                  <p className="text-sm text-foreground/80 font-medium">
                    {order.machine?.brand} {order.machine?.model}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">{horometerLabel} Actual</p>
                  <p className="text-sm font-mono font-bold text-indigo-400">
                    {order.machine?.current_horometer} {horometerAbbr}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Estado Actual</p>
                  <Badge variant="outline" className="text-[9px] rounded-lg mt-0.5 border-slate-700/60 text-foreground/80 bg-default/50 font-bold uppercase">
                    {order.machine?.status}
                  </Badge>
                </div>
                {/* Clasificación de la falla (spec 4.1) */}
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Clasificación de Falla
                  </p>
                  <p className="text-sm font-medium text-foreground/80">
                    {order.failure_category_label ??
                      failureCategoryLabel(order.failure_category)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Registrada por
                  </p>
                  <p className="text-sm font-medium text-foreground/80 truncate">
                    {order.created_by_name || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Trabajo realizado (spec 5.1): visible una vez liquidada la OT. */}
            {order.work_performed && (
              <div className="space-y-1.5 bg-background/80 p-4 rounded-xl border border-border">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardCheckIcon className="size-3.5 text-emerald-400" />
                  Trabajo Realizado
                </h3>
                <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
                  {order.work_performed}
                </p>
              </div>
            )}

            {/* Controles de Flujo de Trabajo */}
            <div className="pt-4 border-t border-border space-y-3">
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
                  <DialogContent className="bg-card border border-border text-foreground p-6 rounded-2xl max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                        <GaugeIcon className="size-5 text-emerald-400" />
                        Cierre de Orden de Trabajo
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLiquidate} className="space-y-4 mt-2">
                      {/* spec 5.1: descripción detallada del trabajo realizado.
                          Se guarda en el historial técnico del activo. */}
                      <div className="space-y-1">
                        <Label htmlFor="workPerformedInput" className="text-foreground/80 text-xs">
                          Descripción del Trabajo Realizado
                        </Label>
                        <textarea
                          id="workPerformedInput"
                          rows={4}
                          value={workPerformed}
                          onChange={(e) => setWorkPerformed(e.target.value)}
                          placeholder="Detalle las tareas ejecutadas, piezas sustituidas y observaciones técnicas..."
                          className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-none"
                        />
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Quedará registrado en la hoja de vida de la máquina.
                        </p>
                        {isWorkPerformedInvalid && trimmedWorkPerformed.length > 0 && (
                          <p className="text-[10px] font-semibold text-amber-400">
                            Añada algo más de detalle (mínimo 10 caracteres).
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="horometerInput" className="text-foreground/80 text-xs">
                          {horometerLabel} de Cierre de Máquina ({horometerAbbr})
                        </Label>
                        <Input
                          id="horometerInput"
                          type="number"
                          step="0.1"
                          value={horometerInput}
                          onChange={(e) => setHorometerInput(Number(e.target.value))}
                          className="bg-background/80 border-border rounded-xl"
                        />
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {horometerLabel} actual del activo: {order.machine?.current_horometer} {horometerAbbr}
                        </p>
                      </div>

                      {isHorometerInvalid && (
                        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
                          <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                          <span>
                            El {horometerLabel.toLowerCase()} ingresado es menor al {horometerLabel.toLowerCase()} actual de la máquina ({order.machine?.current_horometer} {horometerAbbr}).
                          </span>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="submit"
                          disabled={
                            liquidateMutation.isPending ||
                            isHorometerInvalid ||
                            isWorkPerformedInvalid
                          }
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold"
                        >
                          {liquidateMutation.isPending ? "Liquidando..." : "Confirmar Cierre"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setLiquidateDialogOpen(false)}
                          className="flex-1 rounded-xl border-border text-foreground/80 hover:bg-default/50"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}

              {order.status === "LIQUIDADO" && (
                <div className="p-3.5 rounded-xl bg-background/80 border border-border text-muted-foreground text-xs flex gap-2 items-center justify-center font-medium">
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
        <Card className="border-border bg-surface/20 backdrop-blur-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <WrenchIcon className="size-5 text-indigo-400" />
                Repuestos Consumidos
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Piezas de recambio asignadas al mantenimiento
              </CardDescription>
            </div>

            {/* spec 2.1 / 3.3: SOLO el Planificador asigna repuestos, y puede
                hacerlo desde que la OT se crea (PROGRAMADO) para que el mecánico
                arranque con las piezas ya autorizadas. El Supervisor ya no ve
                este botón. */}
            {canAssignSpareParts && order.status !== "LIQUIDADO" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5">
                    <PackagePlusIcon className="size-4" />
                    Asignar Repuesto
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border border-border text-foreground p-6 rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <PackagePlusIcon className="size-5 text-indigo-400" />
                      Asignar Pieza del Inventario
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddSparePart} className="space-y-4 mt-2">
                    {/* Buscador de repuestos en caliente */}
                    <div className="space-y-1">
                      <Label htmlFor="partSearch" className="text-foreground/80 text-xs">
                        Buscar Repuesto (Código o Nombre)
                      </Label>
                      <Input
                        id="partSearch"
                        type="text"
                        placeholder="Ej. Filtro..."
                        value={sparePartSearch}
                        onChange={(e) => setSparePartSearch(e.target.value)}
                        className="bg-background/80 border-border rounded-xl"
                      />
                    </div>

                    {/* Selector de repuesto encontrado */}
                    <div className="space-y-1">
                      <Label className="text-foreground/80 text-xs">Seleccione el Repuesto</Label>
                      <div className="max-h-36 overflow-y-auto border border-border rounded-xl bg-background/80 p-2 space-y-1">
                        {sparePartsLoading ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Cargando inventario...
                          </p>
                        ) : sparePartsError ? (
                          <p className="text-xs text-rose-400 text-center py-4">
                            No se pudo cargar el inventario. Intente nuevamente.
                          </p>
                        ) : spareParts.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
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
                                  : "hover:bg-default/50 text-foreground/80"
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
                      <div className="space-y-3 p-3 bg-background/80 border border-border rounded-xl">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Pieza seleccionada:</span>
                          <span className="font-bold text-foreground">{selectedPart.name}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Stock disponible:</span>
                          <span className="font-bold font-mono text-foreground">
                            {selectedPartStock} unidades
                          </span>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="qtyInput" className="text-foreground/80 text-xs">
                            Cantidad a Utilizar
                          </Label>
                          <Input
                            id="qtyInput"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              setQuantity(Number.isFinite(parsed) ? parsed : 1);
                            }}
                            className="bg-background/80 border-border rounded-xl"
                          />
                        </div>

                        {/* Bloqueo y Alerta en Rojo si cantidad supera stock disponible */}
                        {isPartOutOfStock && (
                          <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
                            <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                            <span>
                              ¡Advertencia! La cantidad solicitada ({quantity}) supera el stock físico actual ({selectedPartStock}).
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
                        className="flex-1 rounded-xl border-border text-foreground/80 hover:bg-default/50"
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
            <div className="overflow-hidden rounded-xl border border-border bg-background/80">
              <Table>
                <TableHeader className="bg-background/80">
                  <TableRow>
                    <TableHead className="font-semibold text-muted-foreground">Código</TableHead>
                    <TableHead className="font-semibold text-muted-foreground">Descripción</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-right">Cantidad</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-right">Devuelto</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-right">Cons. Neto</TableHead>
                    {canSeeFinancials && (
                      <>
                        <TableHead className="font-semibold text-muted-foreground text-right">Costo Unit. Hist.</TableHead>
                        <TableHead className="font-semibold text-muted-foreground text-right">Subtotal</TableHead>
                      </>
                    )}
                    {canAssignSpareParts && order.status !== "LIQUIDADO" && (
                      <TableHead className="font-semibold text-muted-foreground text-center">Acción</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedParts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canSeeFinancials ? (canAssignSpareParts && order.status !== "LIQUIDADO" ? 8 : 7) : (canAssignSpareParts && order.status !== "LIQUIDADO" ? 6 : 5)} className="text-center py-8 text-muted-foreground font-medium">
                        No se han asignado repuestos a esta orden de trabajo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedParts.map((item, index) => {
                      const itemQuantity = sparePartQuantity(item);
                      const itemReturned = item.quantity_returned ?? 0;
                      const unitCost = sparePartUnitCost(item);
                      const canReturn = canAssignSpareParts && order.status !== "LIQUIDADO" && itemQuantity > itemReturned;
                      return (
                        <TableRow
                          key={item.id ?? `${item.spare_part_id}-${index}`}
                          className="border-b border-border/50 hover:bg-surface/20"
                        >
                          <TableCell className="font-mono font-bold text-indigo-400">
                            {item.spare_part?.code || "REP-REP"}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {item.spare_part?.name || "Repuesto Histórico"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground/80">{itemQuantity}</TableCell>
                          <TableCell className="text-right font-mono text-foreground/80">
                            {itemReturned > 0 ? (
                              <span className="text-emerald-400">{itemReturned}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground/80">
                            {itemQuantity - itemReturned > 0 ? (
                              <span className="text-indigo-300">{itemQuantity - itemReturned}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {canSeeFinancials && (
                            <>
                              <TableCell className="text-right font-mono text-foreground/80">
                                {formatCurrency(unitCost.value)}
                                {!unitCost.isHistorical && (
                                  <span
                                    className="ml-1 text-[9px] font-bold uppercase text-amber-400"
                                    title="Costo estimado del catálogo vigente. Se congela al liquidar la OT."
                                  >
                                    est.
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-indigo-300">
                                {formatCurrency(itemQuantity * unitCost.value)}
                              </TableCell>
                            </>
                          )}
                          {canAssignSpareParts && order.status !== "LIQUIDADO" && (
                            <TableCell className="text-center">
                              {canReturn && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const qty = prompt(
                                      `Cantidad a devolver de "${item.spare_part?.name || "Repuesto Histórico"}" (máx. ${itemQuantity - itemReturned}):`,
                                      "1"
                                    );
                                    if (qty) {
                                      const parsed = parseInt(qty, 10);
                                      if (parsed > 0 && parsed <= itemQuantity - itemReturned) {
                                        returnSparePartMutation.mutate({
                                          spare_part_id: item.spare_part_id,
                                          quantity: parsed,
                                        });
                                      } else {
                                        toast.error(`Cantidad inválida. Debe ser entre 1 y ${itemQuantity - itemReturned}.`);
                                      }
                                    }
                                  }}
                                  disabled={returnSparePartMutation.isPending}
                                  className="rounded-lg border-border text-xs h-7 px-2 text-amber-400 hover:text-amber-300 hover:border-amber-500/30 gap-1"
                                >
                                  <Undo2Icon className="size-3" />
                                  Devolver
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Sumatoria de Costos */}
            {canSeeFinancials && (
              <div className="flex justify-between items-center p-4 bg-background/80 rounded-xl border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CoinsIcon className="size-4 text-indigo-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Costo Financiero de Repuestos
                  </span>
                  {hasEstimatedCosts && (
                    <span className="text-[10px] font-semibold text-amber-400">
                      (incluye estimaciones del catálogo)
                    </span>
                  )}
                </div>
                <span className="font-mono text-lg font-bold text-indigo-400">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===================================================================== */}
        {/* SOLVENCIAS DE REPUESTOS (spec 3.3): descargables en PDF               */}
        {/* ===================================================================== */}
        {canViewSolvencies && solvencies.length > 0 && (
          <Card className="border-border bg-surface/20 backdrop-blur-md rounded-2xl">
            <CardHeader className="border-b border-border pb-4 space-y-0.5">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileTextIcon className="size-5 text-indigo-400" />
                Solvencias de Repuestos
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Documentos emitidos al asignar y devolver repuestos, con
                numeración interna secuencial.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {solvencies.map((solvency) => {
                const dispatched = solvency.status === "DESPACHADO";
                const isReturn = solvency.solvency_type === "DEVOLUCION";
                return (
                  <div
                    key={solvency.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border",
                      isReturn
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-border bg-background/80",
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "font-mono text-sm font-bold",
                          isReturn ? "text-amber-400" : "text-indigo-400",
                        )}>
                          {solvency.code}
                        </span>
                        <Badge
                          className={cn(
                            "px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase",
                            isReturn
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : dispatched
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20",
                          )}
                        >
                          {isReturn ? "Devolución" : dispatched ? "Despachado" : "Pendiente de despacho"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {solvency.total_units} unidad(es) ·{" "}
                        {solvency.items?.length ?? 0} línea(s)
                        {canSeeFinancials && !isReturn
                          ? ` · ${formatCurrency(solvency.total_cost)}`
                          : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground/80">
                        {isReturn ? "Devuelta por" : "Emitida por"}{" "}
                        {solvency.issued_by_name || solvency.issued_by} el{" "}
                        {new Date(solvency.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canDispatchSolvencies && !dispatched && !isReturn && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => dispatchSolvency.mutate(solvency.id)}
                          disabled={dispatchSolvency.isPending}
                          className="rounded-xl border-border text-xs h-8 gap-1.5"
                        >
                          <PackageCheckIcon className="size-3.5" />
                          Despachar
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() =>
                          downloadSolvency.mutate({ id: solvency.id, code: solvency.code })
                        }
                        disabled={downloadSolvency.isPending}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 gap-1.5"
                      >
                        <DownloadIcon className="size-3.5" />
                        PDF
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
