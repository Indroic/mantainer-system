import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import type { UserMetadataResponse, UserRole } from "../types";

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
  const role: UserRole | null = metadata?.role || null;

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
