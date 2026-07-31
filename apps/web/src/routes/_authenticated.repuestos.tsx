import { createFileRoute } from "@tanstack/react-router";
import { useSpareParts, useCreateSparePart } from "@/features/repuestos/hooks/use-spare-parts";
import { useAuth } from "@/features/auth/hooks/use-auth";
import SparePartsTable from "@/features/repuestos/components/spare-parts-table";
import { Button } from "@mantainer-system/ui/components/button";
import { Modal } from "@mantainer-system/ui/components/modal";
import { TextField, NumberField, FieldError, Input, Label } from "@heroui/react";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { apiClient, downloadFile } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  PackageIcon,
  PlusIcon,
  SearchIcon,
  DownloadIcon,
  UploadIcon,
  EyeIcon,
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
  // spec 2.1: SOLO el Planificador ajusta stock, precio o da de baja piezas.
  // Almacén visualiza el stock global (spec 2.3) y puede registrar referencias
  // nuevas, pero no modificar ni eliminar las existentes.
  const { canManageInventory, canCreateSpareParts, canViewInventory, isWarehouse } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: parts = [], isLoading } = useSpareParts(search, {
    enabled: canViewInventory,
  });

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

  const canEdit = canManageInventory;
  const canCreate = canCreateSpareParts;

  /**
   * Exporta el catálogo. Se delega en `downloadFile`, que inyecta el JWT y
   * respeta el nombre de archivo que envía el servidor (antes se duplicaba aquí
   * la URL base y la lógica del token).
   */
  const handleExport = async (format: "xlsx" | "csv" | "pdf") => {
    try {
      await downloadFile("/inventory/export", { params: { format } });
      toast.success(`Inventario exportado en ${format.toUpperCase()}`);
    } catch (error: any) {
      toast.error(error?.message || "Error al exportar inventario");
    }
  };

  /** Importación masiva desde la plantilla Excel o un CSV equivalente. */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiClient.postForm<{
        message?: string;
        errors?: string[];
      }>("/inventory/import", formData);

      toast.success(result?.message || "Carga masiva de repuestos completada");
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      if (errors.length > 0) {
        toast.warning(
          `${errors.length} fila(s) con errores: ${errors.slice(0, 3).join(" · ")}` +
            (errors.length > 3 ? " …" : ""),
          { duration: 10000 },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
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
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PackageIcon className="size-6 text-accent" />
            Inventario de Repuestos e Insumos
          </h2>
          <p className="text-sm text-muted">
            Control de stock físico de recambios, números de parte y puntos de reorden crítico
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Importación / exportación exclusivas del Planificador (spec 2.1). */}
          {canManageInventory && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx,.xlsm,.csv"
                className="hidden"
              />
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl px-4 border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 shadow-md h-8"
              >
                <UploadIcon className="size-4" />
                {importing ? "Importando..." : "Importar"}
              </Button>

              <Button
                variant="outline"
                onClick={() => handleExport("xlsx")}
                className="rounded-xl px-4 border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 shadow-md h-8"
              >
                <DownloadIcon className="size-4" />
                Excel
              </Button>

              <Button
                variant="outline"
                onClick={() => handleExport("pdf")}
                className="rounded-xl px-4 border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 shadow-md h-8"
              >
                <DownloadIcon className="size-4" />
                PDF
              </Button>
            </>
          )}

          {canCreate && (
            <Button
              onClick={() => setDialogOpen(true)}
              className="rounded-xl px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-semibold flex items-center gap-1.5 shadow-md shadow-accent/10 h-8"
            >
              <PlusIcon className="size-4" />
              Registrar Repuesto
            </Button>
          )}
        </div>
      </div>

      {/* Almacén consulta el stock global y puede registrar referencias nuevas,
          pero no ajusta stock, precio ni da de baja piezas (spec 2.3). */}
      {isWarehouse && (
        <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/5 p-3.5 text-xs text-muted">
          <EyeIcon className="size-4 shrink-0 text-accent mt-0.5" />
          <span>
            Puede <strong className="text-foreground">registrar nuevos repuestos</strong>; el
            ajuste de stock, el costo unitario y la baja de artículos existentes corresponden al
            Planificador. Las piezas que debe entregar están en la bandeja de{" "}
            <strong className="text-foreground">Despacho</strong>.
          </span>
        </div>
      )}

      {/* Control de Búsqueda */}
      <div className="relative p-4 rounded-2xl bg-surface/40 border border-border backdrop-blur-md">
        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 size-4.5 text-muted" />
        <Input
          type="text"
          placeholder="Buscar repuestos por código o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-default/60 border-border focus:border-accent rounded-xl text-foreground"
        />
      </div>

      {/* Tabla de Repuestos */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 rounded-xl bg-default/50" />
          <Skeleton className="h-44 rounded-xl bg-default/50" />
        </div>
      ) : (
        <SparePartsTable parts={parts} canEdit={canEdit} />
      )}

      {/* Modal de Registro de Repuesto (HeroUI v3 Modal) */}
      <Modal isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="cover">
            <Modal.Dialog className="max-w-lg bg-background border border-border text-foreground shadow-2xl p-6 rounded-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-2xl font-bold flex items-center gap-2">
                  <PackageIcon className="size-6 text-accent" />
                  Registrar Repuesto / Material
                </Modal.Heading>
                <p className="text-sm text-muted">
                  Añade un nuevo insumo o refacción al inventario del taller
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
                  <div className="grid grid-cols-2 gap-4">
                    {/* Código de Activo (Sistema) */}
                    <form.Field name="code">
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
                            <Label className="text-foreground/85 text-xs font-semibold">Código Corto Sistema</Label>
                            <Input
                              id={field.name}
                              placeholder="Ej. FIL-001"
                              onBlur={field.handleBlur}
                              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                            />
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </TextField>
                        );
                      }}
                    </form.Field>

                    {/* Código Interno (Personalizado) */}
                    <form.Field name="internal_code">
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
                            <Label className="text-foreground/85 text-xs font-semibold">Código Interno Barra</Label>
                            <Input
                              id={field.name}
                              placeholder="Ej. INT-987654"
                              onBlur={field.handleBlur}
                              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                            />
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </TextField>
                        );
                      }}
                    </form.Field>

                    {/* Número de Parte de Fabricante */}
                    <form.Field name="part_number">
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
                            <Label className="text-foreground/85 text-xs font-semibold">Número de Parte OEM</Label>
                            <Input
                              id={field.name}
                              placeholder="Ej. OEM-4W0253"
                              onBlur={field.handleBlur}
                              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                            />
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </TextField>
                        );
                      }}
                    </form.Field>

                    {/* Unidad de Medida */}
                    <form.Field name="unit_of_measure">
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
                            <Label className="text-foreground/85 text-xs font-semibold">Unidad de Medida</Label>
                            <Input
                              id={field.name}
                              placeholder="Ej. Unidades, Litros, Metros"
                              onBlur={field.handleBlur}
                              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                            />
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </TextField>
                        );
                      }}
                    </form.Field>

                    {/* Nombre */}
                    <form.Field name="name">
                      {(field) => {
                        const hasError = field.state.meta.errors.length > 0;
                        return (
                          <TextField
                            name={field.name}
                            isRequired
                            isInvalid={hasError}
                            value={field.state.value}
                            onChange={(val) => field.handleChange(val)}
                            className="w-full col-span-2 flex flex-col gap-1.5"
                          >
                            <Label className="text-foreground/85 text-xs font-semibold">Nombre Descriptivo</Label>
                            <Input
                              id={field.name}
                              placeholder="Ej. Filtro de Aceite CAT de 15 micrones..."
                              onBlur={field.handleBlur}
                              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                            />
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </TextField>
                        );
                      }}
                    </form.Field>

                    {/* Costo Unitario en USD */}
                    <form.Field name="unit_cost_usd">
                      {(field) => {
                        const hasError = field.state.meta.errors.length > 0;
                        return (
                          <NumberField
                            name={field.name}
                            isRequired
                            isInvalid={hasError}
                            value={field.state.value}
                            onChange={(val) => field.handleChange(val || 0.01)}
                            minValue={0.01}
                            step={0.01}
                            formatOptions={{
                              style: "currency",
                              currency: "USD",
                            }}
                            className="w-full flex flex-col gap-1.5"
                          >
                            <Label className="text-foreground/85 text-xs font-semibold">Costo Unitario (USD)</Label>
                            <NumberField.Group className="bg-default/60 border-border rounded-xl">
                              <NumberField.DecrementButton className="text-foreground hover:bg-default" />
                              <NumberField.Input
                                id={field.name}
                                onBlur={field.handleBlur}
                                className="text-foreground text-center"
                              />
                              <NumberField.IncrementButton className="text-foreground hover:bg-default" />
                            </NumberField.Group>
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </NumberField>
                        );
                      }}
                    </form.Field>

                    {/* Stock Mínimo */}
                    <form.Field name="stock_minimum">
                      {(field) => {
                        const hasError = field.state.meta.errors.length > 0;
                        return (
                          <NumberField
                            name={field.name}
                            isRequired
                            isInvalid={hasError}
                            value={field.state.value}
                            onChange={(val) => field.handleChange(val || 0)}
                            minValue={0}
                            className="w-full flex flex-col gap-1.5"
                          >
                            <Label className="text-foreground/85 text-xs font-semibold">Stock Mínimo Alerta</Label>
                            <NumberField.Group className="bg-default/60 border-border rounded-xl">
                              <NumberField.DecrementButton className="text-foreground hover:bg-default" />
                              <NumberField.Input
                                id={field.name}
                                onBlur={field.handleBlur}
                                className="text-foreground text-center"
                              />
                              <NumberField.IncrementButton className="text-foreground hover:bg-default" />
                            </NumberField.Group>
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </NumberField>
                        );
                      }}
                    </form.Field>

                    {/* Stock Actual Físico */}
                    <form.Field name="stock_current">
                      {(field) => {
                        const hasError = field.state.meta.errors.length > 0;
                        return (
                          <NumberField
                            name={field.name}
                            isRequired
                            isInvalid={hasError}
                            value={field.state.value}
                            onChange={(val) => field.handleChange(val || 0)}
                            minValue={0}
                            className="w-full col-span-2 flex flex-col gap-1.5"
                          >
                            <Label className="text-foreground/85 text-xs font-semibold">Stock Físico Inicial</Label>
                            <NumberField.Group className="bg-default/60 border-border rounded-xl">
                              <NumberField.DecrementButton className="text-foreground hover:bg-default" />
                              <NumberField.Input
                                id={field.name}
                                onBlur={field.handleBlur}
                                className="text-foreground text-center"
                              />
                              <NumberField.IncrementButton className="text-foreground hover:bg-default" />
                            </NumberField.Group>
                            {field.state.meta.errors.map((error) => (
                              <FieldError key={String(error)} className="text-xs text-rose-400 font-medium">
                                {String(error)}
                              </FieldError>
                            ))}
                          </NumberField>
                        );
                      }}
                    </form.Field>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-border mt-6">
                    <Button
                      type="submit"
                      disabled={createPartMutation.isPending}
                      className="flex-1 rounded-xl bg-accent hover:bg-accent/80 text-accent-foreground font-semibold"
                    >
                      {createPartMutation.isPending ? "Registrando..." : "Registrar"}
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
