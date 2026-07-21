import { env } from "@mantainer-system/env/server";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import { user } from "./schema/auth";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();

/**
 * Asigna directamente el rol a un usuario de Better Auth (acceso a DB).
 * Se usa para bootstrap del primer Administrador sin sesión admin previa.
 */
export async function setUserRole(userId: string, role: string) {
  await db.update(user).set({ role }).where(eq(user.id, userId));
}

/**
 * Inserta un registro en la bitácora de auditoría forense (`audit_logs`,
 * gestionada por el backend Hexcore en la misma base de datos Postgres).
 *
 * Se expone desde este paquete porque es el dueño del acceso a la base de
 * datos; así otros paquetes (p. ej. la config de Better Auth) pueden dejar
 * traza de acciones que ocurren fuera del backend Hexcore —como la eliminación
 * de usuarios— sin acoplarse a drizzle ni al esquema de la tabla.
 *
 * `entity_id` es UUID en el modelo Hexcore, pero los IDs de Better Auth son
 * texto: el identificador real del objetivo se guarda dentro de `payload`.
 */
export async function insertAuditLog(entry: {
  entityName: string;
  action: string;
  performedBy: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO audit_logs
      (id, entity_name, entity_id, action, payload, performed_by, created_at, updated_at, is_active)
    VALUES
      (gen_random_uuid(), ${entry.entityName}, gen_random_uuid(), ${entry.action},
       ${JSON.stringify(entry.payload)}, ${entry.performedBy}, now(), now(), true)
  `);
}
