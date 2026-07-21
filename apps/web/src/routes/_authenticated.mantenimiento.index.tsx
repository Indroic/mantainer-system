import { createFileRoute } from "@tanstack/react-router";
import { useOrders, useCreateOrder, useMechanics } from "@/features/mantenimiento/hooks/use-maintenance";
import { useMachines } from "@/features/maquinaria/hooks/use-machines";
import { useAuth } from "@/features/auth/hooks/use-auth";
import KanbanBoard from "@/features/mantenimiento/components/kanban-board";
import { Button } from "@mantainer-system/ui/components/button";
import { Modal } from "@mantainer-system/ui/components/modal";
import { TextField, TextArea, FieldError, Label } from "@heroui/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
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
  machine_id: z
    .string()
    .min(5, "Seleccione la maquinaria asociada")
    .refine((v) => v !== "none", "Seleccione la maquinaria asociada"),
  description: z.string().min(5, "Describa el trabajo a realizar"),
  // Debe ser un mecánico real: bloqueamos el placeholder "none" para no enviar
  // un valor no-UUID que el backend rechazaría ("invalid character 'n'").
  assigned_mechanic_id: z
    .string()
    .min(1, "Seleccione el mecánico asignado")
    .refine((v) => v !== "none", "Seleccione el mecánico asignado"),
});

function MantenimientoIndexComponent() {
  const { isAdmin, isSupervisor } = useAuth();
  const canCreate = isAdmin || isSupervisor;
  const [dialogOpen, setDialogOpen] = useState(false);

  // Queries
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  // Máquinas y mecánicos solo se necesitan para el formulario de creación,
  // que únicamente ven Administrador/Supervisor. Se desactivan para el rol
  // mecánico (el endpoint de mecánicos les daría 403 y no lo requieren).
  const { data: machines = [] } = useMachines({ status: "ACTIVA" }, { enabled: canCreate });
  const { data: mechanics = [] } = useMechanics({ enabled: canCreate });

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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <WrenchIcon className="size-6 text-accent animate-spin-slow" />
            Órdenes de Trabajo (OT)
          </h2>
          <p className="text-sm text-muted">
            Control de reparaciones y mantenimientos del taller operativo
          </p>
        </div>

        {canCreate && (
          <Button
            onClick={() => setDialogOpen(true)}
            className="rounded-xl px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-semibold flex items-center gap-1.5 shadow-md shadow-accent/10 h-8"
          >
            <PlusIcon className="size-4" />
            Programar Orden (OT)
          </Button>
        )}
      </div>

      {/* Tablero Kanban y Listado Responsivo */}
      {ordersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-2xl bg-default/50" />
          <Skeleton className="h-96 rounded-2xl bg-default/50" />
          <Skeleton className="h-96 rounded-2xl bg-default/50" />
        </div>
      ) : (
        <KanbanBoard orders={orders} />
      )}

      {/* Modal de Registro de Orden de Trabajo (HeroUI v3 Modal) */}
      <Modal isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="cover">
            <Modal.Dialog className="max-w-xl bg-background border border-border text-foreground shadow-2xl p-6 rounded-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-2xl font-bold flex items-center gap-2">
                  <ClipboardListIcon className="size-6 text-accent" />
                  Programar Orden de Trabajo
                </Modal.Heading>
                <p className="text-sm text-muted">
                  Asigna y calendariza una nueva tarea de mantenimiento correctivo o preventivo
                </p>
              </Modal.Header>
              <Modal.Body className="p-0 pt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                  }}
                  className="space-y-4"
                >
                  {/* Selector de Máquina */}
                  <form.Field name="machine_id">
                    {(field) => (
                      <div className="space-y-1.5 flex flex-col">
                        <Label className="text-foreground/85 text-xs font-semibold">Asociar Maquinaria Pesada</Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(val: any) => field.handleChange(val)}
                        >
                          <SelectTrigger className="bg-default/60 border-border rounded-xl text-foreground text-sm h-9">
                            <SelectValue placeholder="Seleccione maquinaria" />
                          </SelectTrigger>
                          <SelectContent className="bg-overlay border border-border text-foreground rounded-xl">
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
                          <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium mt-1">
                            {getErrorMessage(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  {/* Descripción de Falla / Mantenimiento */}
                  <form.Field name="description">
                    {(field) => {
                      const hasError = field.state.meta.errors.length > 0;
                      return (
                        <TextField
                          name={field.name}
                          isRequired
                          isInvalid={hasError}
                          value={field.state.value}
                          onChange={(val) => field.handleChange(val)}
                          className="w-full flex flex-col gap-1.5"
                        >
                          <Label className="text-foreground/85 text-xs font-semibold">Descripción del Servicio / Falla</Label>
                          <TextArea
                            id={field.name}
                            placeholder="Ej. Cambio de filtros de aceite motor a las 500 hrs..."
                            onBlur={field.handleBlur}
                            rows={4}
                            className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                          />
                          {field.state.meta.errors.map((error) => (
                            <FieldError key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                              {getErrorMessage(error)}
                            </FieldError>
                          ))}
                        </TextField>
                      );
                    }}
                  </form.Field>

                  {/* Mecánico Asignado */}
                  <form.Field name="assigned_mechanic_id">
                    {(field) => (
                      <div className="space-y-1.5 flex flex-col">
                        <Label className="text-foreground/85 text-xs font-semibold">Mecánico Asignado</Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(val: any) => field.handleChange(val)}
                        >
                          <SelectTrigger className="bg-default/60 border-border rounded-xl text-foreground text-sm h-9">
                            <SelectValue placeholder="Seleccione un mecánico" />
                          </SelectTrigger>
                          <SelectContent className="bg-overlay border border-border text-foreground rounded-xl">
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
                          <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium mt-1">
                            {getErrorMessage(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  <div className="flex gap-4 pt-4 border-t border-border mt-6">
                    <Button
                      type="submit"
                      disabled={createOrderMutation.isPending}
                      className="flex-1 rounded-xl bg-accent hover:bg-accent/80 text-accent-foreground font-semibold"
                    >
                      {createOrderMutation.isPending ? "Programando..." : "Programar OT"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1 rounded-xl border-border text-foreground hover:bg-default"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

