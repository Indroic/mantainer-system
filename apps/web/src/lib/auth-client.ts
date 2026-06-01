import { env } from "@mantainer-system/env/web";
import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

const authBaseURL = typeof window !== "undefined" ? window.location.origin : env.VITE_AUTH_URL;

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [jwtClient()],
});
