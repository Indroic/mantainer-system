import { createDb } from "@mantainer-system/db";
import * as schema from "@mantainer-system/db/schema/auth";
import { betterAuth, APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, jwt } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// =============================================================================
// Roles del sistema (en inglés y cortos). Se definen con el access control de
// Better Auth para que el plugin admin los reconozca:
//   - admin:      administra usuarios/sesiones (hereda permisos de adminAc).
//   - supervisor: rol de negocio, sin permisos de administración de Better Auth.
//   - mechanic:   rol por defecto, sin permisos de administración.
// El valor de `role` viaja en el JWT y lo consume el frontend y el backend.
// =============================================================================
const ac = createAccessControl(defaultStatements);
const roles = {
  admin: ac.newRole(adminAc.statements),
  supervisor: ac.newRole({ user: [], session: [] }),
  mechanic: ac.newRole({ user: [], session: [] }),
};

// =============================================================================
// Configuración HARDCODEADA (no depende de variables de entorno).
// Topología SINGLE-ORIGIN (todo detrás del proxy inverso de la web):
//   - web + auth + api:  https://sgmm.indroic.dev
//     · /api/auth/*  -> auth-server (Better Auth)
//     · /trpc/*      -> auth-server
//     · /api/*       -> backend FastAPI
// Al servirse todo desde el mismo dominio, NO hay CORS ni cookies cross-subdominio.
// =============================================================================
const BETTER_AUTH_URL = "https://sgmm.indroic.dev";
const BETTER_AUTH_SECRET =
  "df8374a2b918fcd3e5719365bc920c8de817f5492bc394a108de92bc8172fa8b";
const TRUSTED_ORIGINS = ["https://sgmm.indroic.dev"];

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: TRUSTED_ORIGINS,
    emailAndPassword: {
      enabled: true,
      // El registro público está deshabilitado: las cuentas se crean únicamente
      // vía /create-admin (clave de creación) usando auth.api.createUser, que no
      // pasa por este guard.
      disableSignUp: true,
      // Antes dependíamos del default implícito de Better Auth (8). Lo fijamos
      // explícitamente para que quede documentado y no se rompa si la librería
      // cambia su default en una futura versión.
      minPasswordLength: 8,
    },
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    advanced: {
      // Mismo origen (sgmm.indroic.dev) vía proxy inverso: la cookie de sesión
      // es de primera parte (host-only), por lo que sameSite "lax" es suficiente
      // y evita los problemas de cookies de terceros. El proxy termina TLS y
      // reenvía X-Forwarded-Proto=https, por eso mantenemos secure=true.
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/admin/create-user") {
          const body = ctx.body as { name?: string } | undefined;
          const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ' -]+$/;
          if (body?.name && !NAME_PATTERN.test(body.name)) {
            throw new APIError("BAD_REQUEST", {
              message: "El nombre solo puede contener letras, espacios, apóstrofes y guiones."
            });
          }
        }

        if (ctx.path === "/admin/remove-user" || ctx.path === "/admin/set-role") {
          const body = ctx.body as { userId?: string; role?: string } | undefined;
          if (body?.userId) {
            // 1. Evitar auto-acciones (auto-eliminación o auto-cambio de rol)
            const currentUserId = ctx.context.session?.user?.id;
            if (currentUserId && body.userId === currentUserId) {
              throw new APIError("BAD_REQUEST", {
                message: "No está permitido cambiar tu propio rol o eliminar tu propia cuenta para evitar bloqueos del sistema."
              });
            }

            // 2. Evitar eliminar o cambiar el rol de cualquier administrador
            const targetUser = await ctx.context.internalAdapter.findUserById(body.userId);
            if (targetUser && (targetUser as any).role === "admin") {
              throw new APIError("BAD_REQUEST", {
                message: "No está permitido eliminar o alterar el nivel de acceso de un usuario Administrador por motivos de seguridad."
              });
            }
          }
        }
      }),
    },
    plugins: [
      // El plugin admin añade el campo `role` al usuario (viaja en el JWT) y
      // habilita la gestión de roles. Roles: "admin" | "supervisor" | "mechanic".
      admin({
        ac,
        roles,
        adminRoles: ["admin"],
        defaultRole: "mechanic",
      }),
      jwt(),
    ],
  });
}

export const auth = createAuth();
