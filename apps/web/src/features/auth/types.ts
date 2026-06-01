export type UserRole = "ADMINISTRADOR" | "SUPERVISOR" | "MECANICO";

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
