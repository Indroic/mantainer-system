import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  jwtClient,
  usernameClient,
} from "better-auth/client/plugins";

// Mismo origen que la web: Better Auth se alcanza vía proxy inverso en
// `/api/auth/*` (configurado en nginx). Así no hay CORS ni cookies cross-subdominio.
//
// Se resuelve en tiempo de ejecución para que el mismo bundle funcione en
// producción y en el stack local; fijar el dominio hacía que el login local
// fuese contra el servidor de producción.
const AUTH_URL = typeof window !== "undefined" ? window.location.origin : "";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [
    jwtClient(),
    adminClient(),
    // spec 6.1: habilita `authClient.signIn.username(...)` para iniciar sesión
    // con nombre de usuario en lugar de correo electrónico.
    usernameClient(),
    // spec 6.2: habilita `forgetPassword.emailOtp(...)` y
    // `emailOtp.resetPassword(...)` para el código de 6 dígitos.
    emailOTPClient(),
  ],
});
