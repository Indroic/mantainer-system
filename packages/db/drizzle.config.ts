import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  // IMPORTANTE: Better Auth (drizzle) y el backend FastAPI (Alembic) comparten
  // la misma base de datos `sgmm_auth_db`. Limitamos drizzle-kit EXCLUSIVAMENTE
  // a las tablas de Better Auth para que `push` nunca toque/elimine las tablas
  // gestionadas por Alembic (machines, user_metadata, maintenance_orders, etc.).
  tablesFilter: ["user", "session", "account", "verification"],
});
