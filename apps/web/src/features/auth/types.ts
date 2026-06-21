// Roles de Better Auth (en inglés y cortos). Coinciden con los definidos en
// packages/auth (admin plugin + access control) y con el claim `role` del JWT.
export type UserRole = "admin" | "supervisor" | "mechanic";

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
    image?: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}
