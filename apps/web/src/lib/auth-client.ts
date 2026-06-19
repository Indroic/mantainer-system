import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

// URL HARDCODEADA del servidor de Better Auth.
const AUTH_URL = "https://authsgmm.indroic.dev";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [jwtClient()],
});
