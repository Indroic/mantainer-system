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
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  PackageIcon,
  PlusIcon,
  SearchIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import z from "zod";

export const Route = createFileRoute("/_authenticated/repuestos")({
  component: RepuestosComponent,
});

const sparePartSchema = z.object({
  code: z.string().min(3, "El código debe tener al menos 3 caracteres"),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  stock_minimum: z.number().min(0, "El stock mínimo no puede ser negativo"),
  unit_cost_usd: z.number().min(0.01, "El costo unitario en USD debe ser mayor a 0"),
  stock_current: z.number().min(0, "El stock actual no puede ser negativo"),
  part_number: z.string().min(2, "El número de parte es requerido"),
  unit_of_measure: z.string().min(1, "La unidad de medida es requerida"),
  internal_code: z.string().min(2, "El código interno es requerido"),
});

function RepuestosComponent() {
  const { isAdmin, isSupervisor } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: parts = [], isLoading } = useSpareParts(search);

  // Mutación
  const createPartMutation = useCreateSparePart();

  const form = useForm({
    defaultValues: {
      code: "",
      name: "",
      stock_minimum: 5,
      unit_cost_usd: 10.0,
      stock_current: 10,
      part_number: "",
      unit_of_measure: "Unidades",
      internal_code: "",
    },
    onSubmit: async ({ value }) => {
      // Mapeamos unit_cost_usd a unit_cost para mantener compatibilidad
      const command = {
        ...value,
        unit_cost: value.unit_cost_usd,
      };
      await createPartMutation.mutateAsync(command, {
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

  // Lógica de exportación de CSV (descarga de archivo)
  const handleExportCSV = async () => {
    try {
      const tokenResult = await authClient.token();
      const token = tokenResult?.data?.token;

      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("https://sgmm.indroic.dev/api/inventory/export", {
        headers,
      });

      if (!response.ok) {
        throw new Error("Error en la descarga del reporte CSV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_inventario_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exportado exitosamente");
    } catch (error: any) {
      toast.error(error?.message || "Error al exportar inventario");
    }
  };

  // Lógica de importación de CSV
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const tokenResult = await authClient.token();
      const token = tokenResult?.data?.token;

      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("https://sgmm.indroic.dev/api/inventory/import", {
        method: "POST",
        headers,
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.detail || "Error al importar el archivo CSV");
      }

      toast.success(result.message || `Carga masiva completada: ${result.count} repuestos registrados.`);
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
    } catch (error: any) {
      toast.error(error?.message || "Error al importar inventario");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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
            Control de stock físico de recambios, números de parte y puntos de reorden crítico
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botones de Importación/Exportación CSV exclusivas para administradores */}
          {isAdmin && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportCSV}
                accept=".csv"
                className="hidden"
              />
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl px-4 border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold flex items-center gap-1.5 shadow-md"
              >
                <UploadIcon className="size-4" />
                {importing ? "Importando..." : "Importar CSV"}
              </Button>

              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="rounded-xl px-4 border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold flex items-center gap-1.5 shadow-md"
              >
                <DownloadIcon className="size-4" />
                Exportar CSV
              </Button>
            </>
          )}

          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/10">
                  <PlusIcon className="size-4" />
                  Registrar Repuesto
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-lg shadow-2xl">
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
                    {/* Código de Activo (Sistema) */}
                    <form.Field name="code">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={field.name} className="text-slate-300 text-xs">Código Corto Sistema</Label>
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

                    {/* Código Interno (Personalizado) */}
                    <form.Field name="internal_code">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={field.name} className="text-slate-300 text-xs">Código Interno Barra</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Ej. INT-987654"
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

                    {/* Número de Parte de Fabricante */}
                    <form.Field name="part_number">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={field.name} className="text-slate-300 text-xs">Número de Parte OEM</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Ej. OEM-4W0253"
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

                    {/* Unidad de Medida */}
                    <form.Field name="unit_of_measure">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={field.name} className="text-slate-300 text-xs">Unidad de Medida</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Ej. Unidades, Litros, Metros"
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
                            placeholder="Ej. Filtro de Aceite CAT de 15 micrones..."
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

                    {/* Costo Unitario en USD */}
                    <form.Field name="unit_cost_usd">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={field.name} className="text-slate-300 text-xs">Costo Unitario (USD)</Label>
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
                          <Label htmlFor={field.name} className="text-slate-300 text-xs">Stock Mínimo Alerta</Label>
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
