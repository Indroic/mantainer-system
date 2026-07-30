import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

// Mismo origen que la web: /create-planner se alcanza vía proxy inverso (nginx).
const AUTH_URL = "http://localhost:80";

export const Route = createFileRoute("/setup-admin")({
  component: SetupAdminComponent,
});

function SetupAdminComponent() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      creation_key: "",
      name: "",
      username: "",
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      // 1. Crear el usuario Planificador en Better Auth (gateado por la clave).
      let res: Response;
      try {
        res = await fetch(`${AUTH_URL}/create-planner`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_key: value.creation_key,
            name: value.name,
            // spec 6.1: el acceso se hará con este nombre de usuario.
            username: value.username.trim(),
            email: value.email,
            password: value.password,
          }),
        });
      } catch {
        toast.error("No se pudo contactar al servidor de autenticación");
        return;
      }

      if (res.status === 403) {
        toast.error("Clave de creación inválida");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        toast.error(data.error || "No se pudo crear el Planificador");
        return;
      }

      // 2. Iniciar sesión para establecer la sesión en el navegador. Se usa el
      //    nombre de usuario, que es la credencial de acceso (spec 6.1).
      const { error: signInError } = await authClient.signIn.username({
        username: value.username.trim(),
        password: value.password,
      });
      if (signInError) {
        toast.success("Planificador creado. Inicia sesión.");
        navigate({ to: "/login" });
        return;
      }

      toast.success("Planificador creado correctamente");
      navigate({ to: "/dashboard" });
    },
    validators: {
      onSubmit: z.object({
        creation_key: z.string().min(1, "La clave de creación es obligatoria"),
        name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
        username: z
          .string()
          .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
          .max(30, "El nombre de usuario no puede exceder 30 caracteres")
          .regex(
            /^[a-zA-Z0-9_.]+$/,
            "Solo se permiten letras, números, punto y guion bajo",
          ),
        email: z.email("Correo electrónico inválido"),
        password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
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
          <h1 className="text-2xl font-bold tracking-tight">Crear Planificador</h1>
          <p className="text-sm text-slate-400">
            Crea una cuenta con rol <span className="font-semibold text-emerald-400">Planificador</span>.
            Necesitas la <span className="font-semibold text-slate-200">clave de creación</span> del sistema.
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
          <form.Field name="creation_key">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Clave de creación</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="off"
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

          <form.Field name="username">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Nombre de usuario</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="jmorales1"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Es la credencial con la que iniciará sesión.
                </p>
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

          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Creando Planificador..." : "Crear Planificador"}
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
