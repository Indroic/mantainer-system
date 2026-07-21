import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mantainer-system/ui/components/table";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Button } from "@mantainer-system/ui/components/button";
import { Modal, NumberField, Input, Label } from "@heroui/react";
import type { SparePartResponse } from "../types";
import { AlertTriangleIcon, PackageIcon, Trash2Icon, Edit3Icon, DollarSignIcon } from "lucide-react";
import { useState } from "react";
import { useUpdateSparePartStock, useUpdateSparePartPrice, useSoftDeleteSparePart } from "../hooks/use-spare-parts";
import { cn } from "@mantainer-system/ui/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";

interface SparePartsTableProps {
  parts: SparePartResponse[];
  canEdit?: boolean;
}

export default function SparePartsTable({ parts, canEdit = true }: SparePartsTableProps) {
  const { isAdmin, isSupervisor } = useAuth();
  const canSeeFinancials = isAdmin || isSupervisor;
  const [selectedPart, setSelectedPart] = useState<SparePartResponse | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  const updateStockMutation = useUpdateSparePartStock();
  const updatePriceMutation = useUpdateSparePartPrice();
  const deleteMutation = useSoftDeleteSparePart();

  const handleOpenStockModal = (part: SparePartResponse) => {
    setSelectedPart(part);
    setNewStock(part.stock_current);
    setIsModalOpen(true);
  };

  const handleOpenPriceModal = (part: SparePartResponse) => {
    setSelectedPart(part);
    setNewPrice(part.unit_cost_usd ?? part.unit_cost);
    setIsPriceModalOpen(true);
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    await updateStockMutation.mutateAsync({
      spare_part_id: selectedPart.id,
      new_stock: newStock,
    }, {
      onSuccess: () => {
        setIsModalOpen(false);
        setSelectedPart(null);
      }
    });
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    await updatePriceMutation.mutateAsync({
      spare_part_id: selectedPart.id,
      new_unit_cost_usd: newPrice,
    }, {
      onSuccess: () => {
        setIsPriceModalOpen(false);
        setSelectedPart(null);
      }
    });
  };

  const handleDelete = async (partId: string, partCode: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el repuesto ${partCode} del inventario?`)) {
      await deleteMutation.mutateAsync(partId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm backdrop-blur-md">
        <Table>
          <TableHeader className="bg-default/40 border-b border-border">
            <TableRow>
              <TableHead className="font-semibold text-foreground">Código</TableHead>
              <TableHead className="font-semibold text-foreground">Código Interno</TableHead>
              <TableHead className="font-semibold text-foreground">Nº de Parte</TableHead>
              <TableHead className="font-semibold text-foreground">Nombre</TableHead>
              <TableHead className="font-semibold text-foreground">U. Medida</TableHead>
              {canSeeFinancials && <TableHead className="font-semibold text-foreground text-right">Costo Unitario</TableHead>}
              <TableHead className="font-semibold text-foreground text-right">Stock Mínimo</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Stock Actual</TableHead>
              <TableHead className="font-semibold text-foreground">Estado</TableHead>
              {canEdit && <TableHead className="font-semibold text-foreground text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canSeeFinancials ? (canEdit ? 10 : 9) : (canEdit ? 9 : 8)} className="text-center py-10 text-muted font-medium">
                  No se encontraron repuestos en el inventario.
                </TableCell>
              </TableRow>
            ) : (
              parts.map((part) => {
                const isUnderStock = part.stock_current <= part.stock_minimum;

                return (
                  <TableRow
                    key={part.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-default/40 border-b border-border",
                      isUnderStock && "bg-rose-500/5 hover:bg-rose-500/10"
                    )}
                  >
                    <TableCell className="font-mono font-bold text-accent">{part.code}</TableCell>
                    <TableCell className="font-mono text-muted text-xs">{part.internal_code || "—"}</TableCell>
                    <TableCell className="font-mono text-muted text-xs">{part.part_number || "—"}</TableCell>
                    <TableCell className="font-medium text-foreground">{part.name}</TableCell>
                    <TableCell className="text-muted text-xs">{part.unit_of_measure || "—"}</TableCell>
                    {canSeeFinancials && (
                      <TableCell className="text-right font-mono text-foreground">
                        ${(part.unit_cost_usd ?? part.unit_cost).toFixed(2)}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono text-muted">{part.stock_minimum}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-bold",
                      isUnderStock ? "text-rose-500" : "text-foreground"
                    )}>
                      {part.stock_current}
                    </TableCell>
                    <TableCell>
                      {isUnderStock ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit rounded-lg px-2 py-0.5 border border-rose-500/20 font-bold uppercase text-[9px]">
                          <AlertTriangleIcon className="size-3" />
                          Reorden
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg px-2 py-0.5 font-bold uppercase text-[9px]">
                          Saludable
                        </Badge>
                      )}
                    </TableCell>

                    {canEdit && (
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenStockModal(part)}
                          className="rounded-xl text-accent hover:text-accent-foreground hover:bg-accent/10"
                        >
                          <Edit3Icon className="size-3.5 mr-1" />
                          Ajustar Stock
                        </Button>

                        {canSeeFinancials && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPriceModal(part)}
                            className="rounded-xl text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                          >
                            <DollarSignIcon className="size-3.5 mr-1" />
                            Editar Precio
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(part.id, part.code)}
                          disabled={deleteMutation.isPending}
                          className="rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal para ajuste de stock físico */}
      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-accent/10 text-accent">
                  <PackageIcon className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Ajustar Stock Físico</Modal.Heading>
              </Modal.Header>

              <form onSubmit={handleUpdateStock} className="space-y-4">
                <div className="space-y-1 bg-default/40 p-3 rounded-xl border border-border">
                  <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Repuesto Seleccionado</p>
                  <p className="text-sm font-bold text-foreground">{selectedPart?.name} ({selectedPart?.code})</p>
                  <p className="text-xs text-muted">U. Medida: {selectedPart?.unit_of_measure}</p>
                </div>

                <div className="space-y-2">
                  <NumberField
                    minValue={0}
                    value={newStock}
                    onChange={(val) => setNewStock(val || 0)}
                  >
                    <Label className="text-xs font-semibold text-foreground">Nuevo Stock Físico</Label>
                    <Input className="font-mono text-sm" />
                  </NumberField>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={updateStockMutation.isPending}
                    className="flex-1 rounded-xl bg-accent text-accent-foreground font-semibold"
                  >
                    {updateStockMutation.isPending ? "Guardando..." : "Guardar Ajuste"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-xl border-border text-foreground hover:bg-default"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Modal para edición del costo unitario (USD) */}
      <Modal isOpen={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-emerald-500/10 text-emerald-500">
                  <DollarSignIcon className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Actualizar Costo Unitario</Modal.Heading>
              </Modal.Header>

              <form onSubmit={handleUpdatePrice} className="space-y-4">
                <div className="space-y-1 bg-default/40 p-3 rounded-xl border border-border">
                  <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Repuesto Seleccionado</p>
                  <p className="text-sm font-bold text-foreground">{selectedPart?.name} ({selectedPart?.code})</p>
                  <p className="text-xs text-muted">
                    Costo actual: ${(selectedPart?.unit_cost_usd ?? selectedPart?.unit_cost ?? 0).toFixed(2)} USD
                  </p>
                </div>

                <div className="space-y-2">
                  <NumberField
                    minValue={0}
                    step={0.01}
                    value={newPrice}
                    onChange={(val) => setNewPrice(val || 0)}
                    formatOptions={{ style: "currency", currency: "USD" }}
                  >
                    <Label className="text-xs font-semibold text-foreground">Nuevo Costo Unitario ($ USD)</Label>
                    <Input className="font-mono text-sm" />
                  </NumberField>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={updatePriceMutation.isPending}
                    className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                  >
                    {updatePriceMutation.isPending ? "Guardando..." : "Guardar Precio"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPriceModalOpen(false)}
                    className="flex-1 rounded-xl border-border text-foreground hover:bg-default"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
