// =============================================================================
// Sincronización idempotente del esquema de Better Auth sobre Postgres.
//
// Por qué un script SQL en vez de `drizzle-kit push`:
//   - Better Auth (drizzle) y el backend FastAPI (Alembic) comparten la misma
//     base de datos. La introspección de drizzle-kit sobre toda la DB fallaba
//     en el contenedor de migración.
//   - Este script aplica DDL idempotente EXCLUSIVAMENTE sobre las 4 tablas de
//     Better Auth (user/session/account/verification). No introspecciona ni
//     toca las tablas gestionadas por Alembic, y reporta errores claros.
//
// Es seguro ejecutarlo múltiples veces: usa CREATE TABLE IF NOT EXISTS,
// ADD COLUMN IF NOT EXISTS y CREATE INDEX IF NOT EXISTS. Las claves foráneas
// se añaden sólo si no existen (bloques DO).
// =============================================================================
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate-auth] ERROR: la variable DATABASE_URL no está definida.");
  process.exit(1);
}

const DDL = /* sql */ `
-- ----- TABLA user -----
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "role" text,
  "banned" boolean DEFAULT false,
  "ban_reason" text,
  "ban_expires" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Columnas que pueden faltar si la tabla se creó con un esquema anterior
-- (p. ej. antes de añadir el plugin admin: role/banned/ban_reason/ban_expires).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "image" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

-- ----- TABLA session -----
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");

-- ----- TABLA account -----
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");

-- ----- TABLA verification -----
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- ----- Claves foráneas (sólo si no existen) -----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_fk') THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_user_id_fk') THEN
    ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE;
  END IF;
END $$;
`;

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query(DDL);
  console.log("[migrate-auth] Esquema de Better Auth sincronizado correctamente.");
} catch (err) {
  console.error("[migrate-auth] Falló la sincronización del esquema de auth:");
  console.error(err?.message || err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
