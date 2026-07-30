import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, downloadFile } from "@/lib/api-client";
import { toast } from "sonner";
import type { SolvencyResponse, SolvencyStatus } from "../types";

/**
 * Solvencias de Repuestos (spec 3.3).
 *
 * Se emiten automáticamente cuando el Planificador asigna repuestos a una OT.
 * Almacén usa el listado como bandeja de despacho.
 */
export function useSolvencies(filters?: {
  status?: SolvencyStatus | "ALL";
  machineId?: string;
  orderId?: string;
}) {
  return useQuery({
    queryKey: ["solvencies", filters ?? {}],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status && filters.status !== "ALL") {
        // El backend lo recibe como `status_filter` para no colisionar con el
        // módulo `status` de FastAPI.
        params.status_filter = filters.status;
      }
      if (filters?.machineId) params.machine_id = filters.machineId;
      if (filters?.orderId) params.order_id = filters.orderId;

      const data = await apiClient.get<SolvencyResponse[]>("/solvencies/", { params });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 15 * 1000,
  });
}

export function useSolvency(solvencyId: string) {
  return useQuery({
    queryKey: ["solvencies", solvencyId],
    queryFn: async () => {
      return await apiClient.get<SolvencyResponse>(`/solvencies/${solvencyId}`);
    },
    enabled: !!solvencyId,
  });
}

/** Descarga el comprobante PDF de la Solvencia. */
export function useDownloadSolvencyPdf() {
  return useMutation({
    mutationFn: async (solvency: { id: string; code?: string }) => {
      await downloadFile(`/solvencies/${solvency.id}/pdf`, {
        filename: solvency.code ? `solvencia_${solvency.code}.pdf` : undefined,
      });
    },
    onError: (error: any) =>
      toast.error(error?.message || "No se pudo descargar la Solvencia en PDF"),
  });
}

/** Almacén confirma la entrega física de las piezas de la Solvencia. */
export function useDispatchSolvency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (solvencyId: string) => {
      return await apiClient.put<SolvencyResponse>(
        `/solvencies/${solvencyId}/dispatch`,
      );
    },
    onSuccess: (solvency) => {
      queryClient.invalidateQueries({ queryKey: ["solvencies"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`Solvencia ${solvency?.code ?? ""} marcada como despachada`);
    },
    onError: (error: any) =>
      toast.error(error?.message || "No se pudo registrar el despacho"),
  });
}
