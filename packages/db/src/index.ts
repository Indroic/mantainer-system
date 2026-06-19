import { env } from "@mantainer-system/env/server";
import { eq } from "drizzle-orm";
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
