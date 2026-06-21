import { authClient } from "@/lib/auth-client";
import type { UserRole } from "../types";

/**
 * Normaliza el rol del usuario de Better Auth ("admin" | "supervisor" | "mechanic")
 * a las claves del frontend. Tolera mayúsculas/espacios por robustez.
 */
function normalizeRole(rawRole: string | null | undefined): UserRole | null {
  if (!rawRole) return null;
  const normalized = rawRole.trim().toLowerCase();
  if (normalized === "admin" || normalized === "supervisor" || normalized === "mechanic") {
    return normalized as UserRole;
  }
  return null;
}

/** Etiqueta en español para mostrar en la UI (los roles internos son en inglés). */
const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  mechanic: "Mecánico",
};

export function useAuth() {
  // El rol proviene del usuario de Better Auth (plugin admin) y viaja en la sesión.
  const { data: sessionData, isPending, error } = authClient.useSession();

  const user = sessionData?.user ?? null;
  const isAuthenticated = !!user;
  const role: UserRole | null = normalizeRole((user as { role?: string } | null)?.role);

  return {
    user,
    session: sessionData?.session ?? null,
    isAuthenticated,
    isLoading: isPending,
    role,
    roleLabel: role ? ROLE_LABELS[role] : null,
    isAdmin: role === "admin",
    isSupervisor: role === "supervisor",
    isMechanic: role === "mechanic",
    hasRole: (allowedRoles: UserRole[]) => role !== null && allowedRoles.includes(role),
    error,
  };
}
