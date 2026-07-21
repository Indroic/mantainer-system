import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  MaintenanceOrderResponse,
  CreateMaintenanceOrderCommand,
  AddSparePartToOrderCommand,
  LiquidateOrderCommand,
  MechanicResponse,
} from "../types";
import { toast } from "sonner";

export function useOrders(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["maintenance-orders", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status && filters.status !== "ALL") {
        params.status = filters.status;
      }
      return await apiClient.get<MaintenanceOrderResponse[]>("/maintenance/", { params });
    },
    staleTime: 10 * 1000, // Refrescar rápido debido al flujo en tiempo real del taller
  });
}

export function useMechanics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => {
      return await apiClient.get<MechanicResponse[]>("/user-metadata/mechanics");
    },
    staleTime: 60 * 1000,
    // El endpoint /user-metadata/mechanics está restringido a Administrador y
    // Supervisor. Solo se necesita para programar OT (que el mecánico no puede),
    // así que se desactiva para el rol mecánico y evitamos un 403 innecesario.
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
      toast.success("Repuesto asignado con éxito a la orden");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al asignar el repuesto");
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
      toast.success("Orden de trabajo liquidada con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al liquidar la orden de trabajo");
    },
  });
}
