import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { ApiError, apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/setup-admin")({
  loader: async () => {
    // Si ya existe un administrador, esta pantalla no debe usarse.
    let adminExists = false;
    try {
      const result = await apiClient.get<{ admin_exists: boolean }>(
        "/user-metadata/admin-exists",
      );
      adminExists = result.admin_exists;
    } catch (err) {
      // Ante un error de red dejamos continuar: el backend revalidará al enviar
      // el bootstrap y devolverá 409 si ya existe un administrador.
      if (!(err instanceof ApiError)) throw err;
    }
    if (adminExists) {
      throw redirect({ to: "/login" });
    }
  },
  component: SetupAdminComponent,
});

function SetupAdminComponent() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      hourly_rate: 0,
    },
    onSubmit: async ({ value }) => {
      // 1. Crear la cuenta en Better Auth (auto inicia sesión).
      const { error: signUpError } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.name,
      });

      if (signUpError) {
        toast.error(signUpError.message || "No se pudo crear la cuenta");
        return;
      }

      // 2. Promover al usuario recién creado a Administrador inicial.
      try {
        await apiClient.post("/user-metadata/bootstrap-admin", {
          hourly_rate: value.hourly_rate,
        });
        toast.success("Administrador inicial creado correctamente");
        navigate({ to: "/dashboard" });
      } catch (err: any) {
        if (err?.status === 409) {
          toast.error("Ya existe un administrador. Inicia sesión.");
          navigate({ to: "/login" });
          return;
        }
        toast.error(err?.message || "No se pudo asignar el rol de administrador");
      }
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
        email: z.email("Correo electrónico inválido"),
        password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
        hourly_rate: z.number().min(0, "La tarifa no puede ser negativa"),
      }),
    },
  });

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 size-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 size-[400px] rounded-full bg-emerald-600/10 blur-[120px]" />

      <div className="relative z-10 mx-4 w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/40 p-8 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-600/20 p-3">
            <ShieldCheckIcon className="size-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración inicial</h1>
          <p className="text-sm text-slate-400">
            Crea la cuenta del <span className="font-semibold text-emerald-400">Administrador</span> inicial
            del sistema. Esta pantalla solo está disponible mientras no exista ninguno.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nombre completo</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-rose-400">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Correo electrónico</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-rose-400">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Contraseña</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-rose-400">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="hourly_rate">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Tarifa por hora (opcional)</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-rose-400">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Creando administrador..." : "Crear administrador inicial"}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-indigo-400 hover:text-indigo-300">
            ¿Ya tienes una cuenta? Inicia sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
