import { createFileRoute } from "@tanstack/react-router";
import { useOrders, useCreateOrder, useMechanics } from "@/features/mantenimiento/hooks/use-maintenance";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import { useAuth } from "@/features/auth/hooks/use-auth";
import KanbanBoard from "@/features/mantenimiento/components/kanban-board";
import { Button } from "@mantainer-system/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@mantainer-system/ui/components/dialog";
import { Label } from "@mantainer-system/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { Textarea } from "@mantainer-system/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { WrenchIcon, PlusIcon, ClipboardListIcon } from "lucide-react";
import { useState } from "react";
import z from "zod";

export const Route = createFileRoute("/_authenticated/mantenimiento/")({
  component: MantenimientoIndexComponent,
});

function getErrorMessage(error: any): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if (error.message) return error.message;
    if (error.value) return String(error.value);
  }
  return String(error);
}

const orderSchema = z.object({
  machine_id: z.string().min(5, "Seleccione la maquinaria asociada"),
  description: z.string().min(5, "Describa el trabajo a realizar"),
  assigned_mechanic_id: z.string().min(1, "Seleccione el mecánico asignado"),
});

function MantenimientoIndexComponent() {
  const { isAdmin, isSupervisor } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Queries
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: machines = [] } = useMachines({ status: "ACTIVA" }); // Programar solo en máquinas activas
  const { data: mechanics = [] } = useMechanics();

  // Mutación
  const createOrderMutation = useCreateOrder();

  const form = useForm({
    defaultValues: {
      machine_id: "",
      description: "",
      assigned_mechanic_id: "", // El usuario debe seleccionar un mecánico real
    },
    onSubmit: async ({ value }) => {
      await createOrderMutation.mutateAsync(value, {
        onSuccess: () => {
          setDialogOpen(false);
          form.reset();
        },
      });
    },
    validators: {
      onChange: orderSchema,
    },
  });

  const canCreate = isAdmin || isSupervisor;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <WrenchIcon className="size-6 text-indigo-400 animate-spin-slow" />
            Órdenes de Trabajo (OT)
          </h2>
          <p className="text-sm text-slate-400">
            Control de reparaciones y mantenimientos del taller operativo
          </p>
        </div>

        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/10">
                <PlusIcon className="size-4" />
                Programar Orden (OT)
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-md shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ClipboardListIcon className="size-5 text-indigo-400" />
                  Programar Orden de Trabajo
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
                className="space-y-4 mt-2"
              >
                {/* Selector de Máquina */}
                <form.Field name="machine_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="text-slate-300 text-xs">Asociar Maquinaria Pesada</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => field.handleChange(val)}
                      >
                        <SelectTrigger className="bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
                          <SelectValue placeholder="Seleccione maquinaria" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
                          {machines.length === 0 ? (
                            <SelectItem value="none" disabled>No hay máquinas activas disponibles</SelectItem>
                          ) : (
                            machines.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.code} ({m.brand} {m.model})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {field.state.meta.errors.map((error) => (
                        <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                          {getErrorMessage(error)}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>

                {/* Descripción de Falla / Mantenimiento */}
                <form.Field name="description">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="text-slate-300 text-xs">Descripción del Servicio / Falla</Label>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ej. Cambio de filtros de aceite motor a las 500 hrs..."
                        rows={4}
                        className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                      />
                      {field.state.meta.errors.map((error) => (
                        <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                          {getErrorMessage(error)}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>

                {/* Mecánico Asignado */}
                <form.Field name="assigned_mechanic_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="text-slate-300 text-xs">Mecánico Asignado</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => field.handleChange(val)}
                      >
                        <SelectTrigger className="bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
                          <SelectValue placeholder="Seleccione un mecánico" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
                          {mechanics.length === 0 ? (
                            <SelectItem value="none" disabled>No hay mecánicos registrados</SelectItem>
                          ) : (
                            mechanics.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {field.state.meta.errors.map((error) => (
                        <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                          {getErrorMessage(error)}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>

                <div className="flex gap-3 pt-3">
                  <Button
                    type="submit"
                    disabled={createOrderMutation.isPending}
                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold"
                  >
                    {createOrderMutation.isPending ? "Programando..." : "Programar OT"}
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
      </div>

      {/* Tablero Kanban y Listado Responsivo */}
      {ordersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-2xl bg-slate-800/40" />
          <Skeleton className="h-96 rounded-2xl bg-slate-800/40" />
          <Skeleton className="h-96 rounded-2xl bg-slate-800/40" />
        </div>
      ) : (
        <KanbanBoard orders={orders} />
      )}
    </div>
  );
}
