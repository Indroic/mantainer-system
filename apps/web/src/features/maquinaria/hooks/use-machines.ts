import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  MachineResponse,
  CreateMachineCommand,
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
      toast.success("Maquinaria dada de baja lógicamente con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al dar de baja la maquinaria");
    },
  });
}
