import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_AUTH_URL: z.url(),
    VITE_API_URL: z.url(),
  },
  runtimeEnv: {
    ...(typeof process !== "undefined" ? process.env : {}),
    ...((import.meta as any).env ?? {}),
  },
  emptyStringAsUndefined: true,
});
