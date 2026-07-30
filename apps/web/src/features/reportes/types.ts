export interface AuditLogResponse {
  id: string;
  entity_name: string;
  entity_id: string;
  action: string;
  payload: string;
  performed_by: string;
  performed_by_name: string | null;
  created_at: string;
  is_active: boolean;
}

export interface CostReportItem {
  machine_code: string;
  machine_brand: string;
  machine_model: string;
  spare_parts_cost: number;
}

export interface CostReportResponse {
  total_spare_parts_cost: number;
  machines_cost_breakdown: CostReportItem[];
}

// ===========================================================================
// Analítica avanzada (spec 4.2)
// ===========================================================================

/** Filtros temporales globales del reporte. */
export type ReportPeriod = "ANUAL" | "MENSUAL" | "SEMANAL" | "PERSONALIZADO" | "TOTAL";

/** Alcance: toda la empresa o un activo concreto. */
export type ReportScope = "GENERAL" | "INDIVIDUAL";

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "ANUAL", label: "Anual" },
  { value: "TOTAL", label: "Histórico completo" },
];

export interface AnalyticsFilters {
  period: ReportPeriod;
  scope: ReportScope;
  machine_id?: string | null;
  failure_category?: string | null;
  reference_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  limit?: number;
}

export interface ResolvedPeriod {
  period: ReportPeriod;
  label: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface AnalyticsTotals {
  total_spare_parts_cost: number;
  total_orders: number;
  liquidated_orders: number;
  open_orders: number;
  total_units_consumed: number;
  machines_with_failures: number;
  average_cost_per_order: number;
}

/** Maquinaria con más gastos acumulados. */
export interface MachineCostItem {
  machine_id?: string | null;
  machine_code: string;
  machine_brand?: string | null;
  machine_model?: string | null;
  total_cost: number;
  orders_count: number;
  percentage: number;
}

/** Partes / repuestos más utilizados. */
export interface SparePartUsageItem {
  spare_part_id?: string | null;
  spare_part_code: string;
  spare_part_name: string;
  total_quantity: number;
  total_cost: number;
  orders_count: number;
  percentage: number;
}

/** Máquinas con mayor índice de averías. */
export interface MachineFailureItem {
  machine_id?: string | null;
  machine_code: string;
  machine_brand?: string | null;
  machine_model?: string | null;
  failures_count: number;
  percentage: number;
  total_cost: number;
}

export interface FailureCategoryItem {
  category: string;
  label: string;
  count: number;
  percentage: number;
  total_cost: number;
}

export interface TrendBucket {
  label: string;
  bucket_start: string;
  total_cost: number;
  orders_count: number;
}

export interface AnalyticsReportResponse {
  resolved_period: ResolvedPeriod;
  scope: ReportScope;
  machine_id?: string | null;
  machine_code?: string | null;
  failure_category?: string | null;
  totals: AnalyticsTotals;
  top_machines_by_cost: MachineCostItem[];
  top_spare_parts: SparePartUsageItem[];
  top_machines_by_failures: MachineFailureItem[];
  failures_by_category: FailureCategoryItem[];
  cost_trend: TrendBucket[];
}
