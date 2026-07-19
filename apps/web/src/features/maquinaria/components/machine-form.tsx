import { useForm } from "@tanstack/react-form";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { Textarea } from "@mantainer-system/ui/components/textarea";
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
  description: z.string().optional(),
  location: z.string().optional(),
});

export default function MachineForm() {
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
            navigate({ to: "/maquinaria" });
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
      className="space-y-6 max-w-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-8 rounded-2xl shadow-xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Código */}
        <form.Field name="code">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-slate-300">Código del Activo</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ej. CAT-320D"
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

        {/* Serial del Motor — validación @ */}
        <form.Field name="motor_serial">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-slate-300">Serial del Motor</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ej. SER987654 (sin '@')"
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

        {/* Marca */}
        <form.Field name="brand">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-slate-300">Marca</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ej. Caterpillar"
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

        {/* Modelo */}
        <form.Field name="model">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-slate-300">Modelo</Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Ej. 320D"
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

        {/* Año de Fabricación */}
        <form.Field name="manufacture_year">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-slate-300">Año de Fabricación</Label>
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

        {/* Horómetro Inicial + Unidad */}
        <div className="space-y-2">
          <Label className="text-slate-300">Horómetro Inicial</Label>
          <div className="flex gap-2">
            <form.Field name="current_horometer">
              {(field) => (
                <div className="flex-1">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.1"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl animate-none"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={String(error)} className="text-xs text-rose-400 font-medium mt-1">
                      {String(error)}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Field name="horometer_unit">
              {(field) => (
                <Select
                  value={field.state.value}
                  onValueChange={(val) => field.handleChange(val as "Horas" | "Kilómetros" | "Millas")}
                >
                  <SelectTrigger className="w-36 bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
                    <SelectItem value="Horas">Horas</SelectItem>
                    <SelectItem value="Kilómetros">Kilómetros</SelectItem>
                    <SelectItem value="Millas">Millas</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          </div>
        </div>
      </div>

      {/* Ubicación Física */}
      <form.Field name="location">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name} className="text-slate-300">
              Ubicación Física <span className="text-slate-500 font-normal">(opcional)</span>
            </Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Ej. Planta Norte — Bahía 3"
              className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
            />
          </div>
        )}
      </form.Field>

      {/* Descripción General */}
      <form.Field name="description">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name} className="text-slate-300">
              Descripción del Activo <span className="text-slate-500 font-normal">(opcional)</span>
            </Label>
            <Textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Ej. Excavadora de cadenas para trabajos en campo, con adjunto de martillo hidráulico..."
              rows={3}
              className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
            />
          </div>
        )}
      </form.Field>

      <div className="flex gap-4 pt-4 border-t border-slate-800/80">
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
        >
          {createMutation.isPending ? "Registrando..." : "Registrar Maquinaria"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/maquinaria" })}
          className="rounded-xl px-6 border-slate-800 hover:bg-slate-800 text-slate-300"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}


