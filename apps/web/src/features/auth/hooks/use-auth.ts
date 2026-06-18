import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import type { UserMetadataResponse, UserRole } from "../types";

/**
 * Normaliza el rol devuelto por el backend ("Administrador" | "Supervisor" | "Mecánico")
 * a las claves usadas en el frontend ("ADMINISTRADOR" | "SUPERVISOR" | "MECANICO"),
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
  // 1. Obtener la sesión activa de Better Auth
  const { data: sessionData, isPending: sessionPending, error: sessionError } = authClient.useSession();

  const isAuthenticated = !!sessionData?.user;

  // 2. Obtener la metadata local del usuario autenticado (RBAC) desde FastAPI
  const {
    data: metadata,
    isPending: metadataPending,
    error: metadataError,
    refetch: refetchMetadata,
  } = useQuery({
    queryKey: ["user-metadata", "me", sessionData?.user?.id],
    queryFn: async () => {
      if (!isAuthenticated) return null;
      try {
        return await apiClient.get<UserMetadataResponse>("/user-metadata/me");
      } catch (err) {
        console.error("Error al obtener metadatos de usuario en FastAPI:", err);
        // Retornamos un fallback por defecto si falla la carga en local (por ejemplo en desarrollo)
        return {
          id: "",
          better_auth_user_id: sessionData?.user?.id || "",
          role: "MECANICO" as UserRole,
          hourly_rate: 0,
        };
      }
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Caché por 5 minutos
  });

  const isLoading = sessionPending || (isAuthenticated && metadataPending);
  const role: UserRole | null = normalizeRole(metadata?.role);

  return {
    user: sessionData?.user || null,
    session: sessionData?.session || null,
    metadata,
    isAuthenticated,
    isLoading,
    role,
    isAdmin: role === "ADMINISTRADOR",
    isSupervisor: role === "SUPERVISOR",
    isMechanic: role === "MECANICO",
    hasRole: (allowedRoles: UserRole[]) => role !== null && allowedRoles.includes(role),
    refetchMetadata,
    error: sessionError || metadataError,
  };
}
