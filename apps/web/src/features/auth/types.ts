// Roles de Better Auth (en inglés y cortos). Coinciden con los definidos en
// packages/auth (admin plugin + access control) y con el claim `role` del JWT.
//
// El antiguo rol "admin" pasó a llamarse "planner" (Planificador) y se añadió
// "warehouse" (Almacén). `"admin"` se mantiene únicamente como alias heredado
// para que las sesiones abiertas con cuentas sin migrar sigan funcionando.
export type UserRole = "planner" | "supervisor" | "mechanic" | "warehouse";

/** Valor crudo del claim `role`, incluyendo el alias heredado. */
export type RawUserRole = UserRole | "admin";

export interface UserMetadataResponse {
  id: string;
  better_auth_user_id: string;
  role: UserRole;
  hourly_rate: number;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    username?: string | null;
    displayUsername?: string | null;
    image?: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}
