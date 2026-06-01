import { createFileRoute } from "@tanstack/react-router";
import { useSpareParts, useCreateSparePart } from "@/features/repuestos/hooks/use-spare-parts";
import { useAuth } from "@/features/auth/hooks/use-auth";
import SparePartsTable from "@/features/repuestos/components/spare-parts-table";
import { Button } from "@mantainer-system/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@mantainer-system/ui/components/dialog";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { PackageIcon, PlusIcon, SearchIcon, AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import z from "zod";

export const Route = createFileRoute("/_authenticated/repuestos")({
  component: RepuestosComponent,
});

const sparePartSchema = z.object({
  code: z.string().min(3, "El código debe tener al menos 3 caracteres"),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  stock_minimum: z.number().min(0, "El stock mínimo no puede ser negativo"),
  unit_cost: z.number().min(0.01, "El costo unitario debe ser mayor a 0"),
  stock_current: z.number().min(0, "El stock actual no puede ser negativo"),
});

function RepuestosComponent() {
  const { isAdmin, isSupervisor } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Queries
  const { data: parts = [], isLoading } = useSpareParts(search);

  // Mutación
  const createPartMutation = useCreateSparePart();

  const form = useForm({
    defaultValues: {
      code: "",
      name: "",
      stock_minimum: 5,
      unit_cost: 10.0,
      stock_current: 10,
    },
    onSubmit: async ({ value }) => {
      await createPartMutation.mutateAsync(value, {
        onSuccess: () => {
          setDialogOpen(false);
          form.reset();
        },
      });
    },
    validators: {
      onChange: sparePartSchema,
    },
  });

  const canEdit = isAdmin || isSupervisor;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <PackageIcon className="size-6 text-indigo-400" />
            Inventario de Repuestos e Insumos
          </h2>
          <p className="text-sm text-slate-400">
            Control de stock físico de recambios y puntos de reorden crítico
          </p>
        </div>

        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/10">
                <PlusIcon className="size-4" />
                Registrar Repuesto
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-md shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <PackageIcon className="size-5 text-indigo-400" />
                  Registrar Repuesto / Material
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
                <div className="grid grid-cols-2 gap-4">
                  {/* Código */}
                  <form.Field name="code">
                    {(field) => (
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor={field.name} className="text-slate-300 text-xs">Código de Parte</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Ej. FIL-001"
                          className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-xs text-rose-400 font-medium">
                            {String(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  {/* Nombre */}
                  <form.Field name="name">
                    {(field) => (
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor={field.name} className="text-slate-300 text-xs">Nombre Descriptivo</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Ej. Filtro de Aceite CAT..."
                          className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-xs text-rose-400 font-medium">
                            {String(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  {/* Costo Unitario */}
                  <form.Field name="unit_cost">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={field.name} className="text-slate-300 text-xs">Costo Unitario ($)</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="number"
                          step="0.01"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(Number(e.target.value))}
                          className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-xs text-rose-400 font-medium">
                            {String(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  {/* Stock Mínimo */}
                  <form.Field name="stock_minimum">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={field.name} className="text-slate-300 text-xs">Stock Mínimo</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="number"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(Number(e.target.value))}
                          className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-xs text-rose-400 font-medium">
                            {String(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  {/* Stock Actual Físico */}
                  <form.Field name="stock_current">
                    {(field) => (
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor={field.name} className="text-slate-300 text-xs">Stock Físico Inicial</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="number"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(Number(e.target.value))}
                          className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-xs text-rose-400 font-medium">
                            {String(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800/80">
                  <Button
                    type="submit"
                    disabled={createPartMutation.isPending}
                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold"
                  >
                    {createPartMutation.isPending ? "Registrando..." : "Registrar"}
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

      {/* Control de Búsqueda */}
      <div className="relative p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md">
        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 size-4.5 text-slate-500" />
        <Input
          type="text"
          placeholder="Buscar repuestos por código o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
        />
      </div>

      {/* Tabla de Repuestos */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 rounded-xl bg-slate-800/40" />
          <Skeleton className="h-44 rounded-xl bg-slate-800/45" />
        </div>
      ) : (
        <SparePartsTable parts={parts} canEdit={canEdit} />
      )}
    </div>
  );
}
