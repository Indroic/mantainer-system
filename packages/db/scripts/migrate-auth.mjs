// =============================================================================
// Sincronización idempotente del esquema de Better Auth sobre Postgres.
//
// Por qué un script SQL en vez de `drizzle-kit push`:
//   - Better Auth (drizzle) y el backend FastAPI (Alembic) comparten la misma
//     base de datos. La introspección de drizzle-kit sobre toda la DB fallaba
//     en el contenedor de migración.
//   - Este script aplica DDL idempotente EXCLUSIVAMENTE sobre las tablas de
//     Better Auth (user/session/account/verification/jwks). No introspecciona ni
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

-- Columnas del plugin username: el login pasa a hacerse por nombre de usuario
-- en lugar de correo electrónico.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "display_username" text;

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

-- ----- TABLA jwks (plugin jwt: par de claves para firmar/verificar JWT) -----
CREATE TABLE IF NOT EXISTS "jwks" (
  "id" text PRIMARY KEY NOT NULL,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp
);
ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;

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

-- ----- MIGRACIÓN DE DATOS: "admin" pasa a llamarse "planner" (Planificador) -----
-- El rol se renombró en toda la aplicación. Se ejecuta antes de crear el índice
-- único de username para que un fallo de backfill no deje roles a medio migrar.
UPDATE "user" SET "role" = 'planner' WHERE lower("role") IN ('admin', 'administrador');
UPDATE "user" SET "role" = 'mechanic' WHERE lower("role") = 'mecanico';

-- ----- BACKFILL de username para cuentas creadas antes del cambio de login -----
-- Sin username esas cuentas no podrían iniciar sesión. Derivamos uno de la parte
-- local del correo, saneado al juego de caracteres que admite el plugin
-- ([a-zA-Z0-9_.]) y en minúsculas, que es la forma normalizada que espera.
UPDATE "user"
SET "username" = regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_.]', '', 'g')
WHERE "username" IS NULL
  AND regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_.]', '', 'g') <> '';

-- Si el saneado produjo colisiones o cadenas demasiado cortas (el plugin exige
-- 3 caracteres), añadimos un sufijo estable derivado del id del usuario.
UPDATE "user" u
SET "username" = u."username" || '.' || right(md5(u."id"), 4)
WHERE u."username" IS NOT NULL
  AND (
    length(u."username") < 3
    OR EXISTS (
      SELECT 1 FROM "user" d
      WHERE d."username" = u."username" AND d."id" <> u."id"
    )
  );

UPDATE "user" SET "display_username" = "username" WHERE "display_username" IS NULL;

-- El índice único se crea al final, cuando el backfill ya garantiza unicidad.
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unique" ON "user" ("username");
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
