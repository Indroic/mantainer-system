import { createDb } from "@mantainer-system/db";
import * as schema from "@mantainer-system/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";

// =============================================================================
// Configuración HARDCODEADA (no depende de variables de entorno).
// Topología cross-subdominio:
//   - web:  https://sgmm.indroic.dev
//   - auth: https://authsgmm.indroic.dev
//   - api:  https://apisgmm.indroic.dev
// =============================================================================
const BETTER_AUTH_URL = "https://authsgmm.indroic.dev";
const BETTER_AUTH_SECRET =
  "df8374a2b918fcd3e5719365bc920c8de817f5492bc394a108de92bc8172fa8b";
const COOKIE_DOMAIN = ".indroic.dev";
const TRUSTED_ORIGINS = [
  "https://sgmm.indroic.dev",
  "https://authsgmm.indroic.dev",
];

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
    },
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    advanced: {
      // Comparte la cookie de sesión entre subdominios (web y auth).
      crossSubDomainCookies: {
        enabled: true,
        domain: COOKIE_DOMAIN,
      },
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      jwt()
    ],
  });
}

export const auth = createAuth();
