import type { MachineResponse } from "../maquinaria/types";
import type { SparePartResponse } from "../repuestos/types";

export interface MechanicResponse {
  id: string;
  better_auth_user_id?: string;
  name: string;
}

export type OrderStatus = "PROGRAMADO" | "EN_EJECUCION" | "LIQUIDADO";

// ---------------------------------------------------------------------------
// Clasificación de fallas (spec 4.1)
// ---------------------------------------------------------------------------
export type FailureCategory =
  | "SISTEMA_INYECCION"
  | "TRANSMISION"
  | "MOTOR"
  | "SISTEMA_ELECTRICO"
  | "SISTEMA_HIDRAULICO"
  | "FRENOS"
  | "NEUMATICOS"
  | "CHASIS_ESTRUCTURA"
  | "MANTENIMIENTO_PREVENTIVO"
  | "OTROS";

/**
 * Catálogo de clasificaciones de falla con su etiqueta legible.
 *
 * Se declara aquí (y el backend lo expone también en
 * `/maintenance/failure-categories/catalog`) para poder renderizar el selector
 * sin esperar una petición de red.
 */
export const FAILURE_CATEGORIES: { value: FailureCategory; label: string }[] = [
  { value: "SISTEMA_INYECCION", label: "Sistema de Inyección" },
  { value: "TRANSMISION", label: "Transmisión" },
  { value: "MOTOR", label: "Motor" },
  { value: "SISTEMA_ELECTRICO", label: "Sistema Eléctrico" },
  { value: "SISTEMA_HIDRAULICO", label: "Sistema Hidráulico" },
  { value: "FRENOS", label: "Frenos" },
  { value: "NEUMATICOS", label: "Neumáticos" },
  { value: "CHASIS_ESTRUCTURA", label: "Chasis / Estructura" },
  { value: "MANTENIMIENTO_PREVENTIVO", label: "Mantenimiento Preventivo" },
  { value: "OTROS", label: "Otros" },
];

export function failureCategoryLabel(
  category?: FailureCategory | string | null,
): string {
  if (!category) return "Sin clasificar";
  return (
    FAILURE_CATEGORIES.find((item) => item.value === category)?.label ??
    String(category)
  );
}

// ---------------------------------------------------------------------------
// Solvencia de Repuestos (spec 3.3)
// ---------------------------------------------------------------------------
export type SolvencyStatus = "PENDIENTE_DESPACHO" | "DESPACHADO" | "ANULADA";

export interface SolvencyItemResponse {
  id: string;
  spare_part_id: string;
  spare_part_code: string;
  spare_part_name: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export type SolvencyType = "ASIGNACION" | "DEVOLUCION";

export interface SolvencyResponse {
  id: string;
  code: string;
  solvency_type?: SolvencyType;
  maintenance_order_id: string;
  machine_id: string;
  machine_code?: string | null;
  issued_by: string;
  issued_by_name?: string | null;
  status: SolvencyStatus;
  dispatched_by?: string | null;
  dispatched_by_name?: string | null;
  notes?: string | null;
  items: SolvencyItemResponse[];
  total_cost: number;
  total_units: number;
  order_description?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface OrderSparePartResponse {
  id: string;
  maintenance_order_id?: string | null;
  spare_part_id: string;
  /** Alias de `quantity_requested`; algunos endpoints no lo rellenan. */
  quantity?: number | null;
  quantity_requested?: number | null;
  quantity_returned?: number | null;
  /**
   * Costo histórico congelado. Es `null` hasta que la OT se liquida, por lo que
   * NUNCA debe usarse directamente: usar los helpers de `utils/order-costs`.
   */
  unit_cost_at_time?: number | null;
  spare_part?: SparePartResponse | null;
}

export interface MaintenanceOrderResponse {
  id: string;
  machine_id: string;
  description: string;
  assigned_mechanic_id: string;
  assigned_mechanic_name?: string | null;
  status: OrderStatus;
  next_service_horometer: number | null;
  failure_category?: FailureCategory | null;
  failure_category_label?: string | null;
  /** Descripción detallada del trabajo realizado, capturada al liquidar (spec 5.1). */
  work_performed?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  machine?: MachineResponse | null;
  /** Puede llegar ausente o `null` en respuestas parciales del backend. */
  spare_parts?: OrderSparePartResponse[] | null;
  /** Solvencias emitidas para esta OT, descargables en PDF (spec 3.3). */
  solvencies?: SolvencyResponse[] | null;
}

export interface CreateMaintenanceOrderCommand {
  machine_id: string;
  description: string;
  assigned_mechanic_id: string;
  failure_category?: FailureCategory | null;
  performed_by?: string;
}

export interface AddSparePartToOrderCommand {
  spare_part_id: string;
  quantity: number;
  performed_by?: string;
}

export interface ReturnSparePartCommand {
  spare_part_id: string;
  quantity: number;
  performed_by?: string;
}

export interface LiquidateOrderCommand {
  current_horometer: number;
  /** Descripción detallada del trabajo realizado (spec 5.1). */
  work_performed?: string;
  performed_by?: string;
}
