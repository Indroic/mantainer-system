import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    // URL pública propia del servidor de Better Auth (p. ej. https://authsgmm.indroic.dev)
    BETTER_AUTH_URL: z.url(),
    // Origen(es) permitido(s) para CORS. Acepta varios separados por coma.
    CORS_ORIGIN: z.string().min(1),
    // Dominio compartido para cookies cross-subdominio (p. ej. .indroic.dev).
    // Si se omite, las cookies quedan ligadas al host del servidor de auth.
    COOKIE_DOMAIN: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
