import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  SparePartResponse,
  CreateSparePartCommand,
  UpdateSparePartStockCommand,
  UpdateSparePartPriceCommand,
} from "../types";
import { toast } from "sonner";

export function useSpareParts(search?: string) {
  return useQuery({
    queryKey: ["spare-parts", search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) {
        params.search = search;
      }
      return await apiClient.get<SparePartResponse[]>("/inventory/", { params });
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateSparePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateSparePartCommand) => {
      return await apiClient.post<SparePartResponse>("/inventory/", command);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Repuesto registrado con éxito en inventario");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al registrar el repuesto");
    },
  });
}

export function useUpdateSparePartStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: UpdateSparePartStockCommand) => {
      return await apiClient.put<SparePartResponse>("/inventory/stock", command);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Stock físico actualizado con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al actualizar el stock");
    },
  });
}

export function useUpdateSparePartPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: UpdateSparePartPriceCommand) => {
      const { spare_part_id, new_unit_cost_usd } = command;
      return await apiClient.put<SparePartResponse>(`/inventory/${spare_part_id}/price`, {
        new_unit_cost_usd,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Costo unitario actualizado con éxito");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al actualizar el costo unitario");
    },
  });
}

export function useSoftDeleteSparePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sparePartId: string) => {
      return await apiClient.delete<SparePartResponse>(`/inventory/${sparePartId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Repuesto eliminado con éxito del inventario");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al eliminar el repuesto");
    },
  });
}
