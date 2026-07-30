import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import type { AlertResponse, NotificationInboxResponse } from "../types";

/** Bandeja vacía usada como valor por defecto para no ramificar en cada consumidor. */
const EMPTY_INBOX: NotificationInboxResponse = { unread_count: 0, items: [] };

/**
 * Bandeja de notificaciones del usuario autenticado.
 *
 * El filtrado por rol lo aplica el backend (spec 3.2): el Mecánico no recibe
 * avisos de bajo stock. El frontend NO vuelve a derivar notificaciones a partir
 * del inventario, que era la causa de que el Mecánico las viera.
 */
export function useNotifications(options?: { onlyUnread?: boolean }) {
  return useQuery({
    queryKey: ["notifications", options?.onlyUnread ?? false],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (options?.onlyUnread) params.only_unread = "true";
      const data = await apiClient.get<NotificationInboxResponse>("/notifications/", {
        params,
      });
      // El backend siempre devuelve el objeto completo, pero blindamos la forma
      // para que la campana nunca rompa la cabecera de la aplicación.
      return {
        unread_count: Number(data?.unread_count ?? 0),
        items: Array.isArray(data?.items) ? data.items : [],
      } satisfies NotificationInboxResponse;
    },
    // La campana debe sentirse inmediata: las notificaciones se emiten al crear,
    // asignar y liquidar OT.
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
    placeholderData: EMPTY_INBOX,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiClient.put(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "No se pudo marcar la notificación como leída");
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await apiClient.put<{ updated: number }>("/notifications/read-all");
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const updated = Number(result?.updated ?? 0);
      if (updated > 0) {
        toast.success(`${updated} notificación(es) marcada(s) como leída(s)`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "No se pudieron marcar las notificaciones");
    },
  });
}

/**
 * Alertas activas del sistema, ya filtradas por rol en el servidor.
 *
 * Complementan a las notificaciones: son el estado actual (stock bajo,
 * mantenimiento próximo, componente vencido), no un evento puntual.
 */
export function useAlerts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const data = await apiClient.get<AlertResponse[]>("/alerts/");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/** Dispara el barrido que genera/resuelve alertas y emite notificaciones. */
export function useCheckAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await apiClient.post<AlertResponse[]>("/alerts/check");
    },
    onSuccess: (alerts) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const count = Array.isArray(alerts) ? alerts.length : 0;
      toast.success(
        count > 0
          ? `Barrido completado: ${count} alerta(s) generada(s) o resuelta(s)`
          : "Barrido completado: sin cambios en las alertas",
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al ejecutar el barrido de alertas");
    },
  });
}
