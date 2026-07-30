import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, downloadFile } from "@/lib/api-client";
import type {
  MachineResponse,
  CreateMachineCommand,
  CreateMaintenancePlanCommand,
  FleetStatusResponse,
  MachineExportFormat,
  MachineImportResult,
  MaintenancePlanResponse,
  UpdateMachineHorometerCommand,
  ChangeMachineStatusCommand,
} from "../types";
import { toast } from "sonner";
import { horometerUnitAbbr, horometerNoun } from "../types";

export function useMachines(
  filters?: { status?: string; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["machines", filters],
    queryFn: async () => {
      // Construimos los parámetros de búsqueda de forma dinámica
      const params: Record<string, string> = {};
      if (filters?.status && filters.status !== "ALL") {
        params.status = filters.status;
      }
      if (filters?.search) {
        params.search = filters.search;
      }
      return await apiClient.get<MachineResponse[]>("/machines/", { params });
    },
    staleTime: 30 * 1000, // Datos frescos durante 30 segundos
    enabled: options?.enabled ?? true,
  });
}

export function useMachine(machineId: string) {
  return useQuery({
    queryKey: ["machines", machineId],
    queryFn: async () => {
      return await apiClient.get<MachineResponse>(`/machines/${machineId}`);
    },
    enabled: !!machineId,
  });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateMachineCommand) => {
      return await apiClient.post<MachineResponse>("/machines/", command);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Maquinaria registrada con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al registrar la maquinaria");
    },
  });
}

export function useUpdateHorometer(machineId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: UpdateMachineHorometerCommand) => {
      return await apiClient.put<MachineResponse>(`/machines/${machineId}/horometer`, command);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["machines", machineId] });
      toast.success(
        `${horometerNoun(data.horometer_unit)} actualizado con éxito a ${data.current_horometer} ${horometerUnitAbbr(data.horometer_unit)}`
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al actualizar el horómetro");
    },
  });
}

export function useChangeMachineStatus(machineId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: ChangeMachineStatusCommand) => {
      return await apiClient.put<MachineResponse>(`/machines/${machineId}/status`, command);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["machines", machineId] });
      toast.success(`Estado de maquinaria actualizado a: ${data.status}`);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al cambiar el estado de la maquinaria");
    },
  });
}

export function useSoftDeleteMachine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (machineId: string) => {
      return await apiClient.delete<MachineResponse>(`/machines/${machineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-status"] });
      toast.success("Maquinaria dada de baja lógicamente con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al dar de baja la maquinaria");
    },
  });
}

/**
 * Estado de la flota en porcentajes (spec 4.3).
 *
 * Se calcula en el backend para que la tarjeta del dashboard y las
 * exportaciones muestren exactamente la misma cifra.
 */
export function useFleetStatus() {
  return useQuery({
    queryKey: ["fleet-status"],
    queryFn: async () => {
      return await apiClient.get<FleetStatusResponse>("/reports/fleet-status");
    },
    // El estado de la flota cambia al iniciar/liquidar una OT: refresco corto
    // para que el dashboard se sienta en tiempo real.
    staleTime: 10 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Importación / exportación del catálogo de maquinaria (spec 4.4)
// ---------------------------------------------------------------------------
export function useExportMachines() {
  return useMutation({
    mutationFn: async (format: MachineExportFormat = "xlsx") => {
      await downloadFile("/machines/export", { params: { format } });
    },
    onSuccess: () => toast.success("Exportación de maquinaria generada"),
    onError: (error: any) =>
      toast.error(error?.message || "Error al exportar el catálogo de maquinaria"),
  });
}

export function useDownloadMachineTemplate() {
  return useMutation({
    mutationFn: async () => {
      await downloadFile("/machines/import-template");
    },
    onSuccess: () => toast.success("Plantilla de importación descargada"),
    onError: (error: any) =>
      toast.error(error?.message || "Error al descargar la plantilla"),
  });
}

export function useImportMachines() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return await apiClient.postForm<MachineImportResult>("/machines/import", form);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-status"] });
      toast.success(result?.message || "Importación completada");
      // Los errores por fila no abortan la carga: se informan aparte para que el
      // usuario sepa exactamente qué filas quedaron fuera.
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      if (errors.length > 0) {
        toast.warning(
          `${errors.length} fila(s) con errores: ${errors.slice(0, 3).join(" · ")}` +
            (errors.length > 3 ? " …" : ""),
          { duration: 10000 },
        );
      }
    },
    onError: (error: any) =>
      toast.error(error?.message || "Error al importar el catálogo de maquinaria"),
  });
}

// ---------------------------------------------------------------------------
// Planes de mantenimiento preventivo por componente / uso (spec 5.2)
// ---------------------------------------------------------------------------
export function useMaintenancePlans(machineId?: string) {
  return useQuery({
    queryKey: ["maintenance-plans", machineId ?? "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (machineId) params.machine_id = machineId;
      return await apiClient.get<MaintenancePlanResponse[]>(
        "/alerts/maintenance-plans",
        { params },
      );
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateMaintenancePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateMaintenancePlanCommand) => {
      return await apiClient.post<MaintenancePlanResponse>(
        "/alerts/maintenance-plans",
        command,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-plans"] });
      toast.success("Alerta programada por componente creada con éxito");
    },
    onError: (error: any) =>
      toast.error(error?.message || "Error al crear el plan de mantenimiento"),
  });
}

export function useRegisterPlanService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      return await apiClient.put<MaintenancePlanResponse>(
        `/alerts/maintenance-plans/${planId}/register-service`,
      );
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-plans"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(
        `Servicio de "${plan.component_name}" registrado. Próxima meta: ${plan.target_value.toFixed(0)}.`,
      );
    },
    onError: (error: any) =>
      toast.error(error?.message || "Error al registrar el servicio del componente"),
  });
}

export function useDeleteMaintenancePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      return await apiClient.delete<MaintenancePlanResponse>(
        `/alerts/maintenance-plans/${planId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-plans"] });
      toast.success("Plan de mantenimiento eliminado");
    },
    onError: (error: any) =>
      toast.error(error?.message || "Error al eliminar el plan de mantenimiento"),
  });
}
