import { useForm } from "@tanstack/react-form";
import { Button } from "@mantainer-system/ui/components/button";
import { TextField, NumberField, TextArea, Input, Label, FieldError } from "@heroui/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { useCreateMachine } from "../hooks/use-machines";
import { useNavigate } from "@tanstack/react-router";
import z from "zod";

const machineSchema = z.object({
  code: z.string().min(3, "El código debe tener al menos 3 caracteres"),
  motor_serial: z
    .string()
    .min(5, "El serial del motor debe tener al menos 5 caracteres")
    .refine((v) => !v.includes("@"), "El serial no puede contener el carácter '@'"),
  brand: z.string().min(2, "La marca es requerida"),
  model: z.string().min(2, "El modelo es requerido"),
  manufacture_year: z.number().int().min(1980, "Año debe ser posterior a 1980").max(new Date().getFullYear() + 1, "Año inválido"),
  current_horometer: z.number().min(0, "El horómetro inicial no puede ser negativo"),
  horometer_unit: z.enum(["Horas", "Kilómetros", "Millas"]),
  description: z.string(),
  location: z.string(),
});

interface MachineFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function MachineForm({ onSuccess, onCancel }: MachineFormProps) {
  const createMutation = useCreateMachine();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      code: "",
      motor_serial: "",
      brand: "",
      model: "",
      manufacture_year: new Date().getFullYear(),
      current_horometer: 0,
      horometer_unit: "Horas" as "Horas" | "Kilómetros" | "Millas",
      description: "",
      location: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(
        {
          ...value,
          description: value.description || undefined,
          location: value.location || undefined,
        },
        {
          onSuccess: () => {
            if (onSuccess) onSuccess();
            else navigate({ to: "/maquinaria" });
          },
        }
      );
    },
    validators: {
      onChange: machineSchema,
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6 w-full"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Código */}
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
                <Label className="text-foreground/85 text-xs font-semibold">Código del Activo</Label>
                <Input
                  id={field.name}
                  placeholder="Ej. CAT-320D"
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

        {/* Serial del Motor — validación @ */}
        <form.Field name="motor_serial">
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
                <Label className="text-foreground/85 text-xs font-semibold">Serial del Motor</Label>
                <Input
                  id={field.name}
                  placeholder="Ej. SER987654 (sin '@')"
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

        {/* Marca */}
        <form.Field name="brand">
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
                <Label className="text-foreground/85 text-xs font-semibold">Marca</Label>
                <Input
                  id={field.name}
                  placeholder="Ej. Caterpillar"
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

        {/* Modelo */}
        <form.Field name="model">
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
                <Label className="text-foreground/85 text-xs font-semibold">Modelo</Label>
                <Input
                  id={field.name}
                  placeholder="Ej. 320D"
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

        {/* Año de Fabricación */}
        <form.Field name="manufacture_year">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <NumberField
                name={field.name}
                isRequired
                isInvalid={hasError}
                value={field.state.value}
                onChange={(val) => field.handleChange(val || new Date().getFullYear())}
                minValue={1980}
                maxValue={new Date().getFullYear() + 1}
                className="w-full flex flex-col gap-1.5"
              >
                <Label className="text-foreground/85 text-xs font-semibold">Año de Fabricación</Label>
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

        {/* Horómetro Inicial + Unidad */}
        <div className="flex gap-2 items-end">
          <form.Field name="current_horometer">
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
                  step={0.1}
                  className="flex-1 flex flex-col gap-1.5"
                >
                  <Label className="text-foreground/85 text-xs font-semibold">Horómetro Inicial</Label>
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
          <form.Field name="horometer_unit">
            {(field) => (
              <div className="flex flex-col gap-1.5 pb-0.5">
                <Label className="text-foreground/85 text-xs font-semibold opacity-0 select-none">Unidad</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val: any) => field.handleChange(val as "Horas" | "Kilómetros" | "Millas")}
                >
                  <SelectTrigger className="w-32 bg-default/60 border-border rounded-xl text-foreground text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-overlay border border-border text-foreground rounded-xl">
                    <SelectItem value="Horas">Horas</SelectItem>
                    <SelectItem value="Kilómetros">Kilómetros</SelectItem>
                    <SelectItem value="Millas">Millas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </div>
      </div>

      {/* Ubicación Física */}
      <form.Field name="location">
        {(field) => (
          <TextField
            name={field.name}
            value={field.state.value}
            onChange={(val) => field.handleChange(val)}
            className="w-full flex flex-col gap-1.5"
          >
            <Label className="text-foreground/85 text-xs font-semibold">
              Ubicación Física <span className="text-muted font-normal">(opcional)</span>
            </Label>
            <Input
              id={field.name}
              placeholder="Ej. Planta Norte — Bahía 3"
              onBlur={field.handleBlur}
              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
            />
          </TextField>
        )}
      </form.Field>

      {/* Descripción General */}
      <form.Field name="description">
        {(field) => (
          <TextField
            name={field.name}
            value={field.state.value}
            onChange={(val) => field.handleChange(val)}
            className="w-full flex flex-col gap-1.5"
          >
            <Label className="text-foreground/85 text-xs font-semibold">
              Descripción del Activo <span className="text-muted font-normal">(opcional)</span>
            </Label>
            <TextArea
              id={field.name}
              placeholder="Ej. Excavadora de cadenas para trabajos en campo, con adjunto de martillo hidráulico..."
              onBlur={field.handleBlur}
              rows={3}
              className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
            />
          </TextField>
        )}
      </form.Field>

      <div className="flex gap-4 pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-xl px-6 bg-accent hover:bg-accent/80 text-accent-foreground font-semibold"
        >
          {createMutation.isPending ? "Registrando..." : "Registrar Maquinaria"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (onCancel) onCancel();
            else navigate({ to: "/maquinaria" });
          }}
          className="rounded-xl px-6 border-border hover:bg-default text-foreground"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
