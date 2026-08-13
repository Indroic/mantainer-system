import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, downloadFile } from "@/lib/api-client";
import { orderSparePartsTotal } from "@/features/mantenimiento/utils/order-costs";
import { toast } from "sonner";
import type {
  AnalyticsFilters,
  AnalyticsReportResponse,
  AuditLogFacetsResponse,
  AuditLogFilters,
  AuditLogResponse,
  CostReportResponse,
} from "../types";

/** Centinela de los selectores para representar "sin filtro". */
const ALL = "ALL";

export function useAuditLogs(filters?: AuditLogFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      // Solo se envían los filtros con valor real: el centinela "ALL" significa
      // "sin filtro" y enviarlo como valor literal no casaría con ningún registro.
      const assign = (key: keyof AuditLogFilters) => {
        const value = filters?.[key]?.trim();
        if (value && value !== ALL) params[key] = value;
      };
      assign("entity_name");
      assign("action");
      assign("search");
      assign("date_from");
      assign("date_to");

      const data = await apiClient.get<AuditLogResponse[]>("/audit-logs/", { params });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Entidades y operaciones que existen de verdad en la bitácora.
 *
 * Los desplegables se construyen con esto para que ningún filtro ofrezca un
 * valor que la bitácora no contiene (el motivo por el que los filtros
 * `UPDATE` y `DELETE` no devolvían nada: el backend graba `UPDATE_STOCK`,
 * `SOFT_DELETE`, etc.).
 */
export function useAuditFacets(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["audit-log-facets"],
    queryFn: async () =>
      await apiClient.get<AuditLogFacetsResponse>("/audit-logs/facets"),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
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

          const orderPartsCost = orderSparePartsTotal(order);

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

// ===========================================================================
// Analítica avanzada (spec 4.2)
// ===========================================================================

/**
 * Traduce los filtros de la UI al cuerpo que espera el backend.
 *
 * Se centraliza para que la consulta y la exportación pidan EXACTAMENTE el mismo
 * recorte de datos: si divergieran, el PDF no coincidiría con la pantalla.
 */
function toAnalyticsBody(filters: AnalyticsFilters) {
  return {
    period: filters.period,
    scope: filters.scope,
    // El backend exige `machine_id` cuando el alcance es INDIVIDUAL y lo ignora
    // cuando es GENERAL.
    machine_id: filters.scope === "INDIVIDUAL" ? filters.machine_id || null : null,
    failure_category: filters.failure_category || null,
    reference_date: filters.reference_date || null,
    start_date: filters.start_date || null,
    end_date: filters.end_date || null,
    limit: filters.limit ?? 10,
  };
}

/** Mismos filtros como query params, para los endpoints de descarga (GET). */
function toAnalyticsParams(filters: AnalyticsFilters): Record<string, string> {
  const body = toAnalyticsBody(filters);
  const params: Record<string, string> = {};
  Object.entries(body).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params[key] = String(value);
    }
  });
  return params;
}

export function useAnalyticsReport(filters: AnalyticsFilters) {
  // Un reporte Individual sin máquina seleccionada no es consultable: se espera
  // a que el usuario elija el activo en lugar de provocar un 400.
  const isReady = filters.scope !== "INDIVIDUAL" || !!filters.machine_id;

  return useQuery({
    queryKey: ["analytics-report", filters],
    queryFn: async () => {
      return await apiClient.post<AnalyticsReportResponse>(
        "/reports/analytics",
        toAnalyticsBody(filters),
      );
    },
    enabled: isReady,
    staleTime: 30 * 1000,
  });
}

/** Descarga el reporte analítico en PDF o Excel (spec 4.4). */
export function useExportAnalyticsReport() {
  return useMutation({
    mutationFn: async ({
      filters,
      format,
    }: {
      filters: AnalyticsFilters;
      format: "pdf" | "xlsx";
    }) => {
      await downloadFile("/reports/analytics/export", {
        params: { ...toAnalyticsParams(filters), format },
      });
    },
    onSuccess: () => toast.success("Reporte exportado con éxito"),
    onError: (error: any) =>
      toast.error(error?.message || "No se pudo exportar el reporte"),
  });
}
