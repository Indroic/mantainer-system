import { authClient } from "@/lib/auth-client";
import type { UserRole } from "../types";

/**
 * Normaliza el rol del usuario de Better Auth ("Administrador" | "Supervisor" | "Mecánico")
 * a las claves del frontend ("ADMINISTRADOR" | "SUPERVISOR" | "MECANICO"),
 * quitando acentos y pasando a mayúsculas.
 */
function normalizeRole(rawRole: string | null | undefined): UserRole | null {
  if (!rawRole) return null;
  const normalized = rawRole
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  if (normalized === "ADMINISTRADOR" || normalized === "SUPERVISOR" || normalized === "MECANICO") {
    return normalized as UserRole;
  }
  return null;
}

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
    isAdmin: role === "ADMINISTRADOR",
    isSupervisor: role === "SUPERVISOR",
    isMechanic: role === "MECANICO",
    hasRole: (allowedRoles: UserRole[]) => role !== null && allowedRoles.includes(role),
    error,
  };
}
