import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@mantainer-system/api/context";
import { appRouter } from "@mantainer-system/api/routers/index";
import { auth } from "@mantainer-system/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Clave de creación del administrador (HARDCODEADA). Quien la conozca puede crear
// un Administrador desde /setup-admin. Cámbiala por una cadena privada en producción.
const ADMIN_CREATION_KEY = "SGMM-CLAVE-ADMIN-2026";

const app = new Hono();

app.use(logger());

// Orígenes permitidos HARDCODEADOS (origen de la web y del propio auth).
const ALLOWED_ORIGINS = [
  "https://sgmm.indroic.dev",
  "https://authsgmm.indroic.dev",
];

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

// Crea un usuario Administrador en Better Auth, gateado por una clave estática.
// No requiere admin previo ni JWT: registra vía Better Auth y fija el rol en DB.
app.post("/create-admin", async (c) => {
  let body: {
    creation_key?: string;
    name?: string;
    email?: string;
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

  try {
    // createUser (plugin admin) crea el usuario con su rol en una sola llamada y
    // NO pasa por `disableSignUp`. Llamado server-side sin headers, no exige una
    // sesión de admin previa.
    const result = await auth.api.createUser({
      body: {
        email: body.email,
        password: body.password,
        name: body.name,
        // El rol custom "Administrador" es válido en runtime (definido en el
        // plugin admin), aunque el tipo inferido por defecto solo contemple
        // "user" | "admin".
        role: "Administrador" as unknown as "admin",
      },
    });
    const userId = result?.user?.id;
    if (!userId) {
      return c.json({ error: "No se pudo crear el usuario" }, 500);
    }
    return c.json({ ok: true, userId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al crear el administrador";
    return c.json({ error: message }, 400);
  }
});

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
