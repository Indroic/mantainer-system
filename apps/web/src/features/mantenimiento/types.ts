import type { MachineResponse } from "../maquinaria/types";
import type { SparePartResponse } from "../repuestos/types";

export type OrderStatus = "PROGRAMADO" | "EN_EJECUCION" | "LIQUIDADO";

export interface OrderSparePartResponse {
  id: string;
  maintenance_order_id: string;
  spare_part_id: string;
  quantity: number;
  unit_cost_at_time: number;
  spare_part?: SparePartResponse;
}

export interface MaintenanceOrderResponse {
  id: string;
  machine_id: string;
  description: string;
  assigned_mechanic_id: string;
  status: OrderStatus;
  next_service_horometer: number | null;
  created_at: string;
  updated_at: string;
  machine?: MachineResponse;
  spare_parts: OrderSparePartResponse[];
}

export interface CreateMaintenanceOrderCommand {
  machine_id: string;
  description: string;
  assigned_mechanic_id: string;
  performed_by?: string;
}

export interface AddSparePartToOrderCommand {
  spare_part_id: string;
  quantity: number;
  performed_by?: string;
}

export interface LiquidateOrderCommand {
  current_horometer: number;
  performed_by?: string;
}
