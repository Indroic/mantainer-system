import { Button } from "@mantainer-system/ui/components/button";
import { TextField, Input, Label, FieldError } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

/**
 * Formulario de inicio de sesión.
 *
 * spec 6.1: la credencial principal es el NOMBRE DE USUARIO (p. ej. "jmorales1"),
 * no el correo electrónico. El correo sigue siendo obligatorio en la cuenta, pero
 * solo se usa para notificaciones y para la recuperación de contraseña.
 */
export default function SignInForm({
  onForgotPassword,
}: {
  onForgotPassword?: () => void;
}) {
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.username(
        {
          username: value.username.trim(),
          password: value.password,
        },
        {
          onSuccess: () => {
            window.location.href = "/dashboard";
            toast.success("Sesión iniciada correctamente");
          },
          onError: (error) => {
            // Un fallo de red contra el servidor de auth llega como "Failed to fetch":
            // mostramos un mensaje claro en español en lugar del texto crudo.
            const raw = error.error.message || error.error.statusText || "";
            let message: string;
            if (/failed to fetch|fetch failed|networkerror/i.test(raw)) {
              message = "No se pudo contactar al servidor de autenticación";
            } else if (/invalid username or password|unauthorized/i.test(raw)) {
              message = "Nombre de usuario o contraseña incorrectos";
            } else {
              message = raw || "No se pudo iniciar sesión";
            }
            toast.error(message);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        username: z
          .string()
          .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
          .max(30, "El nombre de usuario no puede exceder 30 caracteres")
          .regex(
            /^[a-zA-Z0-9_.]+$/,
            "Solo se permiten letras, números, punto y guion bajo",
          ),
        password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Bienvenido de nuevo</h1>
        <p className="text-sm text-slate-400">Ingresa tus credenciales para continuar</p>
      </div>

      {/* Nombre de usuario (credencial de acceso) */}
      <form.Field name="username">
        {(field) => {
          const hasError = field.state.meta.errors.length > 0;
          return (
            <TextField
              name={field.name}
              type="text"
              isRequired
              isInvalid={hasError}
              value={field.state.value}
              onChange={(val) => field.handleChange(val)}
              className="flex w-full flex-col gap-1.5"
            >
              <Label className="text-xs font-semibold text-slate-300">Nombre de usuario</Label>
              <Input
                id={field.name}
                placeholder="jmorales1"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                onBlur={field.handleBlur}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/50 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-400"
              />
              {field.state.meta.errors.map((error) => (
                <FieldError key={String(error)} className="text-xs font-medium text-rose-400">
                  {String(error)}
                </FieldError>
              ))}
            </TextField>
          );
        }}
      </form.Field>

      {/* Contraseña */}
      <form.Field name="password">
        {(field) => {
          const hasError = field.state.meta.errors.length > 0;
          return (
            <TextField
              name={field.name}
              type="password"
              isRequired
              isInvalid={hasError}
              value={field.state.value}
              onChange={(val) => field.handleChange(val)}
              className="flex w-full flex-col gap-1.5"
            >
              <Label className="text-xs font-semibold text-slate-300">Contraseña</Label>
              <Input
                id={field.name}
                placeholder="••••••••"
                autoComplete="current-password"
                onBlur={field.handleBlur}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-950/50 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-400"
              />
              {field.state.meta.errors.map((error) => (
                <FieldError key={String(error)} className="text-xs font-medium text-rose-400">
                  {String(error)}
                </FieldError>
              ))}
            </TextField>
          );
        }}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type="submit"
            className="mt-1 w-full rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
          </Button>
        )}
      </form.Subscribe>

      {/* spec 6.2: recuperación de contraseña por código de 6 dígitos */}
      {onForgotPassword && (
        <button
          type="button"
          onClick={onForgotPassword}
          className="mx-auto text-xs font-medium text-slate-400 transition-colors hover:text-indigo-400"
        >
          ¿Olvidaste tu contraseña?
        </button>
      )}
    </form>
  );
}
