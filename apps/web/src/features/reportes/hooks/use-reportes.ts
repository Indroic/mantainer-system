import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AuditLogResponse, CostReportResponse } from "../types";

export function useAuditLogs(filters?: { entity_name?: string; action?: string }) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.entity_name && filters.entity_name !== "ALL") {
        params.entity_name = filters.entity_name;
      }
      if (filters?.action && filters.action !== "ALL") {
        params.action = filters.action;
      }
      return await apiClient.get<AuditLogResponse[]>("/audit-logs/", { params });
    },
    staleTime: 5 * 1000,
  });
}

export function useCostReport() {
  return useQuery({
    queryKey: ["cost-report"],
    queryFn: async () => {
      // El backend expone la sumatoria agregada de costos de repuestos
      // Si aún no está creado el endpoint específico, consultamos el listado y lo procesamos localmente
      try {
        return await apiClient.get<CostReportResponse>("/reports/costs");
      } catch (err) {
        // Fallback local: calcular de forma agregada consultando todas las órdenes liquidadas
        const orders = await apiClient.get<any[]>("/maintenance/");
        const liquidated = orders.filter((o) => o.status === "LIQUIDADO");

        const breakdownMap: Record<string, { code: string; brand: string; model: string; cost: number }> = {};
        let totalCost = 0;

        liquidated.forEach((order) => {
          const mCode = order.machine?.code || "Desconocido";
          const mBrand = order.machine?.brand || "Desconocido";
          const mModel = order.machine?.model || "Desconocido";

          const orderPartsCost = (order.spare_parts || []).reduce(
            (acc: number, item: any) => acc + item.quantity * item.unit_cost_at_time,
            0
          );

          totalCost += orderPartsCost;

          if (!breakdownMap[mCode]) {
            breakdownMap[mCode] = {
              code: mCode,
              brand: mBrand,
              model: mModel,
              cost: 0,
            };
          }
          breakdownMap[mCode].cost += orderPartsCost;
        });

        return {
          total_spare_parts_cost: totalCost,
          machines_cost_breakdown: Object.values(breakdownMap).map((item) => ({
            machine_code: item.code,
            machine_brand: item.brand,
            machine_model: item.model,
            spare_parts_cost: item.cost,
          })),
        };
      }
    },
    staleTime: 30 * 1000,
  });
}
