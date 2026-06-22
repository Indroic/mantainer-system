import { createAuthClient } from "better-auth/react";
import { jwtClient, adminClient } from "better-auth/client/plugins";

// Mismo origen que la web: Better Auth se alcanza vía proxy inverso en
// `/api/auth/*` (configurado en nginx). Así no hay CORS ni cookies cross-subdominio.
const AUTH_URL = "https://sgmm.indroic.dev";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [jwtClient(), adminClient()],
});
