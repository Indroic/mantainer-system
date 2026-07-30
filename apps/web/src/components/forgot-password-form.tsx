import { useState } from "react";
import { Button } from "@mantainer-system/ui/components/button";
import { TextField, Input, Label, FieldError } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { ArrowLeftIcon, MailCheckIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

/**
 * Recuperación de contraseña mediante código de verificación de 6 dígitos
 * enviado al correo electrónico de la cuenta (spec 6.2).
 *
 * Flujo en dos pasos:
 *   1. El usuario introduce su correo → el servidor envía el código (emailOTP).
 *   2. El usuario introduce el código y la nueva contraseña.
 *
 * Nota de seguridad: el paso 1 SIEMPRE avanza, exista o no la cuenta. Confirmar
 * la existencia de un correo permitiría enumerar usuarios del sistema.
 */

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-700/70 bg-slate-950/50 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-400";

export default function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");

  // ---------------------------------------------------------------------
  // Paso 1: solicitar el código
  // ---------------------------------------------------------------------
  const requestForm = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      const target = value.email.trim().toLowerCase();
      try {
        await authClient.forgetPassword.emailOtp({ email: target });
      } catch {
        // Se ignora el error a propósito: informar de un fallo aquí revelaría si
        // la cuenta existe. El usuario avanza igualmente al paso 2.
      }
      setEmail(target);
      setStep("verify");
      toast.success(
        "Si el correo corresponde a una cuenta registrada, recibirás un código de 6 dígitos.",
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.string().email("Introduce un correo electrónico válido"),
      }),
    },
  });

  // ---------------------------------------------------------------------
  // Paso 2: verificar el código y fijar la nueva contraseña
  // ---------------------------------------------------------------------
  const verifyForm = useForm({
    defaultValues: { otp: "", password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      const { data, error } = await authClient.emailOtp.resetPassword({
        email,
        otp: value.otp.trim(),
        password: value.password,
      });

      if (error || !data) {
        const raw = error?.message || "";
        const message = /invalid|expired|otp/i.test(raw)
          ? "El código es incorrecto o ha caducado. Solicita uno nuevo."
          : raw || "No se pudo restablecer la contraseña";
        toast.error(message);
        return;
      }

      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      onBack();
    },
    validators: {
      onSubmit: z
        .object({
          otp: z
            .string()
            .regex(/^\d{6}$/, "El código debe tener exactamente 6 dígitos"),
          password: z
            .string()
            .min(8, "La contraseña debe tener al menos 8 caracteres"),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Las contraseñas no coinciden",
          path: ["confirmPassword"],
        }),
    },
  });

  const resendCode = async () => {
    try {
      await authClient.forgetPassword.emailOtp({ email });
      toast.success("Se envió un nuevo código a tu correo.");
    } catch {
      toast.error("No se pudo reenviar el código. Inténtalo en unos instantes.");
    }
  };

  if (step === "request") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          requestForm.handleSubmit();
        }}
        className="flex w-full flex-col gap-5"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="mb-1 rounded-xl border border-indigo-500/30 bg-indigo-600/20 p-2.5">
            <MailCheckIcon className="size-5 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-50">
            Recuperar contraseña
          </h1>
          <p className="text-sm text-slate-400">
            Introduce el correo de tu cuenta y te enviaremos un código de verificación
            de 6 dígitos.
          </p>
        </div>

        <requestForm.Field name="email">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <TextField
                name={field.name}
                type="email"
                isRequired
                isInvalid={hasError}
                value={field.state.value}
                onChange={(val) => field.handleChange(val)}
                className="flex w-full flex-col gap-1.5"
              >
                <Label className="text-xs font-semibold text-slate-300">
                  Correo electrónico
                </Label>
                <Input
                  id={field.name}
                  placeholder="tucorreo@empresa.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  onBlur={field.handleBlur}
                  className={INPUT_CLASS}
                />
                {field.state.meta.errors.map((error) => (
                  <FieldError key={String(error)} className="text-xs font-medium text-rose-400">
                    {String(error)}
                  </FieldError>
                ))}
              </TextField>
            );
          }}
        </requestForm.Field>

        <requestForm.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="w-full rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500"
            >
              {isSubmitting ? "Enviando código..." : "Enviar código"}
            </Button>
          )}
        </requestForm.Subscribe>

        <BackButton onClick={onBack} />
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        verifyForm.handleSubmit();
      }}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="mb-1 rounded-xl border border-indigo-500/30 bg-indigo-600/20 p-2.5">
          <ShieldCheckIcon className="size-5 text-indigo-400" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-50">
          Introduce el código
        </h1>
        <p className="text-sm text-slate-400">
          Enviamos un código de 6 dígitos a{" "}
          <span className="font-semibold text-slate-200">{email}</span>. Caduca en
          10 minutos.
        </p>
      </div>

      <verifyForm.Field name="otp">
        {(field) => {
          const hasError = field.state.meta.errors.length > 0;
          return (
            <TextField
              name={field.name}
              type="text"
              isRequired
              isInvalid={hasError}
              value={field.state.value}
              // Solo dígitos y máximo 6: evita pegar espacios o guiones del correo.
              onChange={(val) => field.handleChange(val.replace(/\D/g, "").slice(0, 6))}
              className="flex w-full flex-col gap-1.5"
            >
              <Label className="text-xs font-semibold text-slate-300">
                Código de verificación
              </Label>
              <Input
                id={field.name}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                onBlur={field.handleBlur}
                className={`${INPUT_CLASS} text-center font-mono text-lg tracking-[0.5em]`}
              />
              {field.state.meta.errors.map((error) => (
                <FieldError key={String(error)} className="text-xs font-medium text-rose-400">
                  {String(error)}
                </FieldError>
              ))}
            </TextField>
          );
        }}
      </verifyForm.Field>

      <verifyForm.Field name="password">
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
              <Label className="text-xs font-semibold text-slate-300">Nueva contraseña</Label>
              <Input
                id={field.name}
                placeholder="••••••••"
                autoComplete="new-password"
                onBlur={field.handleBlur}
                className={INPUT_CLASS}
              />
              {field.state.meta.errors.map((error) => (
                <FieldError key={String(error)} className="text-xs font-medium text-rose-400">
                  {String(error)}
                </FieldError>
              ))}
            </TextField>
          );
        }}
      </verifyForm.Field>

      <verifyForm.Field name="confirmPassword">
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
              <Label className="text-xs font-semibold text-slate-300">
                Confirmar contraseña
              </Label>
              <Input
                id={field.name}
                placeholder="••••••••"
                autoComplete="new-password"
                onBlur={field.handleBlur}
                className={INPUT_CLASS}
              />
              {field.state.meta.errors.map((error) => (
                <FieldError key={String(error)} className="text-xs font-medium text-rose-400">
                  {String(error)}
                </FieldError>
              ))}
            </TextField>
          );
        }}
      </verifyForm.Field>

      <verifyForm.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500"
          >
            {isSubmitting ? "Actualizando..." : "Restablecer contraseña"}
          </Button>
        )}
      </verifyForm.Subscribe>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={resendCode}
          className="text-xs font-medium text-slate-400 transition-colors hover:text-indigo-400"
        >
          Reenviar código
        </button>
        <BackButton onClick={onBack} />
      </div>
    </form>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-indigo-400"
    >
      <ArrowLeftIcon className="size-3" />
      Volver al inicio de sesión
    </button>
  );
}
