export interface AuditLogResponse {
  id: string;
  entity_name: string;
  entity_id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  previous_state: string | null;
  new_state: string | null;
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
