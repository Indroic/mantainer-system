import { useForm } from "@tanstack/react-form";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { useCreateMachine } from "../hooks/use-machines";
import { useNavigate } from "@tanstack/react-router";
import z from "zod";

const machineSchema = z.object({
  code: z.string().min(3, "El código debe tener al menos 3 caracteres"),
  motor_serial: z.string().min(5, "El serial del motor debe tener al menos 5 caracteres"),
  brand: z.string().min(2, "La marca es requerida"),
  model: z.string().min(2, "El modelo es requerido"),
  manufacture_year: z.number().int().min(1980, "Año debe ser posterior a 1980").max(new Date().getFullYear() + 1, "Año inválido"),
  current_horometer: z.number().min(0, "El horómetro inicial no puede ser negativo"),
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
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value, {
        onSuccess: () => {
          navigate({ to: "/maquinaria" });
        },
      });
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

        {/* Serial del Motor */}
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
                placeholder="Ej. SER987654"
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

        {/* Horómetro Inicial */}
        <form.Field name="current_horometer">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name} className="text-slate-300">Horómetro Inicial (hrs)</Label>
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
                <p key={String(error)} className="text-xs text-rose-400 font-medium">
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>
      </div>

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
