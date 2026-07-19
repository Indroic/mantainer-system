export interface SparePartResponse {
  id: string;
  code: string;
  name: string;
  stock_minimum: number;
  unit_cost: number;
  stock_current: number;
  part_number?: string | null;
  unit_of_measure?: string | null;
  internal_code?: string | null;
  unit_cost_usd?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSparePartCommand {
  code: string;
  name: string;
  stock_minimum: number;
  unit_cost: number;
  stock_current: number;
  part_number?: string;
  unit_of_measure?: string;
  internal_code?: string;
  unit_cost_usd?: number;
  performed_by?: string;
}

export interface UpdateSparePartStockCommand {
  spare_part_id: string;
  new_stock: number;
  performed_by?: string;
}

