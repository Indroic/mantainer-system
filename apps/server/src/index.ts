import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@mantainer-system/api/context";
import { appRouter } from "@mantainer-system/api/routers/index";
import { auth } from "@mantainer-system/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Clave de creación del Planificador (HARDCODEADA). Quien la conozca puede crear
// un Planificador desde /setup-admin. Cámbiala por una cadena privada en producción.
const ADMIN_CREATION_KEY = "SGMM-CLAVE-ADMIN-2026";

/** Rol del Planificador en Better Auth (antes se llamaba "admin"). */
const PLANNER_ROLE = "planner";

/**
 * Deriva un nombre de usuario válido para el plugin `username`
 * ([a-zA-Z0-9_.], 3-30 caracteres) a partir del correo o del nombre.
 *
 * Se usa solo como respaldo: el formulario de alta pide el usuario explícitamente.
 */
function deriveUsername(email: string, name: string): string {
  const base = (email.split("@")[0] || name || "usuario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9_.]/g, "");
  return (base.length >= 3 ? base : `${base}usr`).slice(0, 30);
}

const app = new Hono();

app.use(logger());

// Orígenes permitidos HARDCODEADOS. En la topología single-origin (todo detrás
// del proxy inverso de la web) las peticiones del navegador son del mismo origen
// y CORS deja de aplicar; este middleware queda como red de seguridad por si el
// servicio se expusiera directamente.
const ALLOWED_ORIGINS = ["https://sgmm.indroic.dev"];

app.use(
  "/*",
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Crea un usuario Planificador en Better Auth, gateado por una clave estática.
// No requiere sesión previa ni JWT: registra vía Better Auth y fija el rol en DB.
// El acceso se hará con `username` (spec 6.1); el correo es obligatorio pero solo
// se usa para notificaciones y recuperación de contraseña.
const createPlannerHandler = async (c: any) => {
  let body: {
    creation_key?: string;
    name?: string;
    email?: string;
    username?: string;
    password?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Cuerpo JSON inválido" }, 400);
  }

  if (body.creation_key !== ADMIN_CREATION_KEY) {
    return c.json({ error: "Clave de creación inválida" }, 403);
  }
  if (!body.email || !body.password || !body.name) {
    return c.json({ error: "Faltan campos: name, email y password" }, 400);
  }

  const desiredUsername = (
    body.username?.trim() || deriveUsername(body.email, body.name)
  ).trim();

  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(desiredUsername)) {
    return c.json(
      {
        error:
          "El nombre de usuario debe tener entre 3 y 30 caracteres y solo puede " +
          "contener letras, números, punto y guion bajo.",
      },
      400,
    );
  }

  try {
    // createUser (plugin admin) crea el usuario con su rol en una sola llamada y
    // NO pasa por `disableSignUp`. Llamado server-side sin headers, no exige una
    // sesión de Planificador previa. `username` va en `data` porque es un campo
    // aportado por el plugin username, no un campo base de createUser.
    const result = await auth.api.createUser({
      body: {
        email: body.email,
        password: body.password,
        name: body.name,
        role: PLANNER_ROLE,
        data: {
          username: desiredUsername.toLowerCase(),
          displayUsername: desiredUsername,
        },
      } as never,
    });
    const userId = result?.user?.id;
    if (!userId) {
      return c.json({ error: "No se pudo crear el usuario" }, 500);
    }
    return c.json({ ok: true, userId, username: desiredUsername });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al crear el Planificador";
    return c.json({ error: message }, 400);
  }
};

app.post("/create-planner", createPlannerHandler);
// Alias heredado: mantiene compatibilidad con clientes que aún llaman /create-admin.
app.post("/create-admin", createPlannerHandler);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
