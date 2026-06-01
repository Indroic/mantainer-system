import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_AUTH_URL: z.url(),
    VITE_API_URL: z.url(),
  },
  runtimeEnv: {
    VITE_AUTH_URL: (typeof window !== "undefined" && (window as any).env?.VITE_AUTH_URL) || (import.meta as any).env?.VITE_AUTH_URL,
    VITE_API_URL: (typeof window !== "undefined" && (window as any).env?.VITE_API_URL) || (import.meta as any).env?.VITE_API_URL,
  },
  emptyStringAsUndefined: true,
});
