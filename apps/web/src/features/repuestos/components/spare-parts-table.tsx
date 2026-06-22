import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mantainer-system/ui/components/table";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@mantainer-system/ui/components/dialog";
import { Label } from "@mantainer-system/ui/components/label";
import type { SparePartResponse } from "../types";
import { AlertTriangleIcon, PackageIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useUpdateSparePartStock, useSoftDeleteSparePart } from "../hooks/use-spare-parts";
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const updateStockMutation = useUpdateSparePartStock();
  const deleteMutation = useSoftDeleteSparePart();

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    await updateStockMutation.mutateAsync({
      spare_part_id: selectedPart.id,
      new_stock: newStock,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
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
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
        <Table>
          <TableHeader className="bg-slate-950/40 border-b border-slate-800/80">
            <TableRow>
              <TableHead className="font-semibold text-slate-300">Código</TableHead>
              <TableHead className="font-semibold text-slate-300">Nombre</TableHead>
              {canSeeFinancials && <TableHead className="font-semibold text-slate-300 text-right">Costo Unitario</TableHead>}
              <TableHead className="font-semibold text-slate-300 text-right">Stock Mínimo</TableHead>
              <TableHead className="font-semibold text-slate-300 text-right">Stock Actual</TableHead>
              <TableHead className="font-semibold text-slate-300">Estado</TableHead>
              {canEdit && <TableHead className="font-semibold text-slate-300 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canSeeFinancials ? (canEdit ? 7 : 6) : (canEdit ? 6 : 5)} className="text-center py-10 text-slate-500 font-medium">
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
                      "transition-colors duration-150 hover:bg-slate-800/20 border-b border-slate-800/50",
                      isUnderStock && "bg-rose-950/5 hover:bg-rose-950/10"
                    )}
                  >
                    <TableCell className="font-mono font-bold text-indigo-400">{part.code}</TableCell>
                    <TableCell className="font-medium text-slate-200">{part.name}</TableCell>
                    {canSeeFinancials && <TableCell className="text-right font-mono text-slate-300">${part.unit_cost.toFixed(2)}</TableCell>}
                    <TableCell className="text-right font-mono text-slate-400">{part.stock_minimum}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-bold",
                      isUnderStock ? "text-rose-400" : "text-slate-200"
                    )}>
                      {part.stock_current}
                    </TableCell>
                    <TableCell>
                      {isUnderStock ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit rounded-lg px-2 py-0.5 border border-rose-500/20 font-bold uppercase text-[9px]">
                          <AlertTriangleIcon className="size-3" data-icon="inline-start" />
                          Reorden
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg px-2 py-0.5 font-bold uppercase text-[9px]">
                          Saludable
                        </Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right space-x-2">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPart(part);
                                setNewStock(part.stock_current);
                                setDialogOpen(true);
                              }}
                              className="rounded-xl text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/20"
                            >
                              Ajustar Stock
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-sm">
                            <DialogHeader>
                              <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <PackageIcon className="size-5 text-indigo-400" />
                                Ajustar Stock Físico
                              </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleUpdateStock} className="space-y-4 mt-2">
                              <div className="space-y-1">
                                <p className="text-xs text-slate-400">Repuesto:</p>
                                <p className="text-sm font-bold text-slate-200">{selectedPart?.name} ({selectedPart?.code})</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="stockInput" className="text-slate-300 text-xs">Nuevo Stock Físico</Label>
                                <Input
                                  id="stockInput"
                                  type="number"
                                  value={newStock}
                                  onChange={(e) => setNewStock(Number(e.target.value))}
                                  className="bg-slate-950/80 border-slate-800 rounded-xl"
                                />
                              </div>
                              <div className="flex gap-3 pt-2">
                                <Button
                                  type="submit"
                                  disabled={updateStockMutation.isPending}
                                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold"
                                >
                                  {updateStockMutation.isPending ? "Guardando..." : "Guardar"}
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

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(part.id, part.code)}
                          disabled={deleteMutation.isPending}
                          className="rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-950/20"
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
    </div>
  );
}
