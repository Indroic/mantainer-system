export interface SparePartResponse {
  id: string;
  code: string;
  name: string;
  stock_minimum: number;
  unit_cost: number;
  stock_current: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSparePartCommand {
  code: string;
  name: string;
  stock_minimum: number;
  unit_cost: number;
  stock_current: number;
  performed_by?: string;
}

export interface UpdateSparePartStockCommand {
  spare_part_id: string;
  new_stock: number;
  performed_by?: string;
}
