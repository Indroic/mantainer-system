// =============================================================================
// Envío de correo del portal SGMM.
//
// Se implementa sobre `fetch` contra una API HTTP (Resend) en lugar de SMTP para
// no añadir dependencias nativas al bundle del servidor. El proveedor se activa
// por variables de entorno; si no hay ninguna configurada, el correo se registra
// en consola en lugar de perderse en silencio, de modo que el flujo de
// recuperación de contraseña sigue siendo probable en desarrollo.
// =============================================================================

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Remitente por defecto cuando no se configura `MAIL_FROM`. */
const DEFAULT_FROM = "SGMM Portal <no-reply@sgmm.indroic.dev>";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface MailConfig {
  apiKey: string | undefined;
  from: string;
}

function readMailConfig(): MailConfig {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    from: process.env.MAIL_FROM?.trim() || DEFAULT_FROM,
  };
}

/**
 * Envía un correo. Nunca lanza: un fallo de entrega no debe romper el flujo de
 * autenticación ni revelar al cliente si la dirección existe.
 */
export async function sendMail(input: SendMailInput): Promise<boolean> {
  const { apiKey, from } = readMailConfig();

  if (!apiKey) {
    // Modo desarrollo: sin proveedor configurado dejamos traza en el log del
    // servidor para poder completar el flujo manualmente.
    console.warn(
      "[mailer] RESEND_API_KEY no está configurada; el correo NO se envió. " +
        "Contenido para desarrollo:\n" +
        `  Para:    ${input.to}\n` +
        `  Asunto:  ${input.subject}\n` +
        `  Cuerpo:  ${input.text}`,
    );
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[mailer] El proveedor rechazó el envío (HTTP ${response.status}): ${detail}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailer] Error de red al enviar el correo:", err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// Plantillas
// -----------------------------------------------------------------------------

/** Minutos de validez del código, alineado con `expiresIn` del plugin emailOTP. */
export const OTP_TTL_MINUTES = 10;

/**
 * Correo con el código de verificación de 6 dígitos para restablecer la
 * contraseña (spec 6.2).
 */
export function passwordResetOtpEmail(otp: string): Omit<SendMailInput, "to"> {
  const subject = `SGMM Portal · Código de recuperación: ${otp}`;

  const text = [
    "Recuperación de contraseña · SGMM Portal",
    "",
    `Tu código de verificación es: ${otp}`,
    "",
    `El código caduca en ${OTP_TTL_MINUTES} minutos y solo puede usarse una vez.`,
    "Si no solicitaste este cambio, ignora este mensaje: tu contraseña no se ha modificado.",
  ].join("\n");

  const html = `
<!-- Estilos en línea: los clientes de correo ignoran las hojas de estilo externas. -->
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#4338ca;padding:20px 24px;">
      <div style="color:#ffffff;font-size:16px;font-weight:700;">SGMM Portal</div>
      <div style="color:#c7d2fe;font-size:12px;">Sistema de Gestión de Mantenimiento de Maquinaria Pesada</div>
    </div>
    <div style="padding:28px 24px;">
      <h1 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Recuperación de contraseña</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
        Usa el siguiente código de verificación para restablecer la contraseña de tu cuenta:
      </p>
      <div style="text-align:center;margin:0 0 20px;">
        <div style="display:inline-block;padding:14px 28px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;
                    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;
                    letter-spacing:8px;color:#4338ca;">${otp}</div>
      </div>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#475569;">
        El código caduca en <strong>${OTP_TTL_MINUTES} minutos</strong> y solo puede usarse una vez.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Si no solicitaste este cambio, ignora este mensaje: tu contraseña no se ha modificado.
      </p>
    </div>
  </div>
</div>`.trim();

  return { subject, html, text };
}

/** Correo genérico de verificación / inicio de sesión con código. */
export function verificationOtpEmail(
  otp: string,
  purpose: "email-verification" | "sign-in" | "change-email",
): Omit<SendMailInput, "to"> {
  const headings: Record<typeof purpose, string> = {
    "email-verification": "Verificación de correo electrónico",
    "sign-in": "Código de inicio de sesión",
    "change-email": "Confirmación de cambio de correo",
  };
  const heading = headings[purpose];

  return {
    subject: `SGMM Portal · ${heading}: ${otp}`,
    text: `${heading} · SGMM Portal\n\nTu código es: ${otp}\n\nCaduca en ${OTP_TTL_MINUTES} minutos.`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
    <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${heading}</h1>
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#4338ca;">${otp}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Caduca en ${OTP_TTL_MINUTES} minutos.</p>
  </div>
</div>`.trim(),
  };
}
