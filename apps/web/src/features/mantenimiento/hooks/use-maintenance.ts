import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, downloadFile } from "@/lib/api-client";
import type {
  MaintenanceOrderResponse,
  CreateMaintenanceOrderCommand,
  AddSparePartToOrderCommand,
  LiquidateOrderCommand,
  ReturnSparePartCommand,
  MechanicResponse,
} from "../types";
import { toast } from "sonner";

export function useOrders(
  filters?: { status?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["maintenance-orders", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status && filters.status !== "ALL") {
        params.status = filters.status;
      }
      const data = await apiClient.get<MaintenanceOrderResponse[]>("/maintenance/", {
        params,
      });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 10 * 1000, // Refrescar rápido debido al flujo en tiempo real del taller
    // El rol Almacén no participa en el flujo de OT: se evita el 403.
    enabled: options?.enabled ?? true,
  });
}

/** Formatos de descarga admitidos por la exportación de OT (spec 4.4). */
export type OrderExportFormat = "xlsx" | "csv" | "pdf";

/**
 * Exporta el listado de Órdenes de Trabajo en Excel, CSV o PDF.
 *
 * Se le pasan los MISMOS filtros que muestra el tablero: si divergieran, el
 * archivo descargado no coincidiría con lo que el usuario tiene delante.
 */
export function useExportOrders() {
  return useMutation({
    mutationFn: async ({
      format,
      filters,
    }: {
      format: OrderExportFormat;
      filters?: { status?: string; machine_id?: string; failure_category?: string };
    }) => {
      const params: Record<string, string> = { format };
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        const token = value?.trim();
        if (token && token !== "ALL") params[key] = token;
      });
      await downloadFile("/maintenance/export", { params });
    },
    onSuccess: () => toast.success("Órdenes de trabajo exportadas con éxito"),
    onError: (error: any) =>
      toast.error(error?.data?.detail || error?.message || "No se pudo exportar el listado"),
  });
}

/** Descarga la Hoja de Orden de Trabajo individual en PDF, lista para firmar. */
export function useExportOrderSheet() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      await downloadFile(`/maintenance/${orderId}/export`);
    },
    onSuccess: () => toast.success("Hoja de OT descargada con éxito"),
    onError: (error: any) =>
      toast.error(error?.data?.detail || error?.message || "No se pudo descargar la OT"),
  });
}

export function useMechanics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => {
      return await apiClient.get<MechanicResponse[]>("/user-metadata/mechanics");
    },
    staleTime: 60 * 1000,
    // El endpoint /user-metadata/mechanics está restringido a los roles que
    // pueden crear OT (Planificador, Supervisor y Mecánico). Se desactiva para
    // quien no puede crearlas y evitamos un 403 innecesario.
    enabled: options?.enabled ?? true,
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ["maintenance-orders", orderId],
    queryFn: async () => {
      return await apiClient.get<MaintenanceOrderResponse>(`/maintenance/${orderId}`);
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateMaintenanceOrderCommand) => {
      return await apiClient.post<MaintenanceOrderResponse>("/maintenance/", command);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
      toast.success("Orden de trabajo programada con éxito");
    },
    onError: (error: any) => {
      // FastAPI retorna errores como { detail: "mensaje" } o { detail: [{...}] }
      const detail = error?.data?.detail ?? error?.message;
      let message: string;
      if (Array.isArray(detail)) {
        // Errores de validación Pydantic: array de objetos con 'msg'
        message = detail.map((e: any) => e?.msg ?? String(e)).join("; ");
      } else if (typeof detail === "string") {
        message = detail;
      } else {
        message = "Error al programar la orden de trabajo";
      }
      toast.error(message);
    },
  });
}

export function useStartOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (performedBy?: string) => {
      return await apiClient.post<MaintenanceOrderResponse>(
        `/maintenance/${orderId}/start`,
        undefined,
        {
          params: performedBy ? { performed_by: performedBy } : {},
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Trabajo iniciado con éxito. Máquina en mantenimiento.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al iniciar la orden de trabajo");
    },
  });
}

export function useAddSparePartToOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: AddSparePartToOrderCommand) => {
      return await apiClient.post<MaintenanceOrderResponse>(
        `/maintenance/${orderId}/spare-parts`,
        command
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      // La asignación emite la Solvencia y notifica a Supervisor, Mecánico y
      // Almacén: hay que refrescar ambas bandejas (spec 3.3).
      queryClient.invalidateQueries({ queryKey: ["solvencies"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(
        "Repuesto asignado. Solvencia de repuestos emitida y notificada a Almacén.",
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al asignar el repuesto");
    },
  });
}

export function useReturnSparePart(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: ReturnSparePartCommand) => {
      return await apiClient.post<MaintenanceOrderResponse>(
        `/maintenance/${orderId}/spare-parts/${command.spare_part_id}/return`,
        command
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      queryClient.invalidateQueries({ queryKey: ["solvencies"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Repuesto devuelto al inventario con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al devolver el repuesto");
    },
  });
}

export function useLiquidateOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: LiquidateOrderCommand) => {
      return await apiClient.post<MaintenanceOrderResponse>(
        `/maintenance/${orderId}/liquidate`,
        command
      );
    },
    onSuccess: () => {
      // Invalidation multi-módulo coordinada para sincronización ACID total en el cliente
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      // Al liquidar cambia el estado de la máquina (vuelve a ACTIVA) y se
      // notifica al Planificador (spec 3.1).
      queryClient.invalidateQueries({ queryKey: ["fleet-status"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Orden de trabajo liquidada con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al liquidar la orden de trabajo");
    },
  });
}
