import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Única variable realmente requerida: la cadena de conexión a Postgres.
    DATABASE_URL: z.string().min(1),
    // Las siguientes están HARDCODEADAS en packages/auth y apps/server, por lo que
    // son opcionales aquí: su ausencia no debe impedir el arranque del servidor.
    BETTER_AUTH_SECRET: z.string().optional(),
    BETTER_AUTH_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
