export type MachineStatus = "ACTIVA" | "EN_MANTENIMIENTO" | "FUERA_DE_SERVICIO" | "DADA_DE_BAJA";
export type HorometerUnit = "Horas" | "Kilómetros" | "Millas";

/** Abreviatura para mostrar junto a la lectura (ej. "1250.0 km"). */
export function horometerUnitAbbr(unit?: HorometerUnit): string {
  switch (unit) {
    case "Kilómetros":
      return "km";
    case "Millas":
      return "mi";
    case "Horas":
    default:
      return "hrs";
  }
}

/** Sustantivo del medidor según la unidad (horómetro para horas, odómetro para distancia). */
export function horometerNoun(unit?: HorometerUnit): string {
  return unit === "Kilómetros" || unit === "Millas" ? "Odómetro" : "Horómetro";
}

export interface MachineResponse {
  id: string;
  code: string;
  motor_serial: string;
  brand: string;
  model: string;
  manufacture_year: number;
  current_horometer: number;
  status: MachineStatus;
  horometer_unit?: HorometerUnit;
  description?: string | null;
  location?: string | null;
  machine_type_id?: string | null;
  machine_type_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMachineCommand {
  code: string;
  motor_serial: string;
  brand: string;
  model: string;
  manufacture_year: number;
  current_horometer: number;
  horometer_unit?: HorometerUnit;
  description?: string | null;
  location?: string | null;
  machine_type_id?: string | null;
  performed_by?: string;
}

export interface UpdateMachineHorometerCommand {
  current_horometer: number;
  performed_by?: string;
}

export interface ChangeMachineStatusCommand {
  status: MachineStatus;
  performed_by?: string;
}

// ---------------------------------------------------------------------------
// Estado de la flota en porcentajes (spec 4.3)
// ---------------------------------------------------------------------------
export interface FleetStatusSlice {
  status: MachineStatus | string;
  label: string;
  count: number;
  percentage: number;
}

export interface FleetStatusResponse {
  total_machines: number;
  slices: FleetStatusSlice[];
}

// ---------------------------------------------------------------------------
// Importación masiva de maquinaria (spec 4.4)
// ---------------------------------------------------------------------------
export interface MachineImportResult {
  created: number;
  updated: number;
  skipped: number;
  message: string;
  errors: string[];
}

/** Formatos de exportación admitidos por el backend. */
export type MachineExportFormat = "xlsx" | "csv" | "pdf";

// ---------------------------------------------------------------------------
// Planes de mantenimiento preventivo por componente / uso (spec 5.2)
// ---------------------------------------------------------------------------
export type MaintenancePlanBasis = "USO" | "TIEMPO";

export interface MaintenancePlanResponse {
  id: string;
  machine_id: string;
  machine_code?: string | null;
  spare_part_id?: string | null;
  spare_part_name?: string | null;
  component_name: string;
  basis: MaintenancePlanBasis;
  interval_value: number;
  last_service_value: number;
  warning_threshold: number;
  notes?: string | null;
  target_value: number;
  current_value: number;
  remaining: number;
  is_due: boolean;
  is_overdue: boolean;
  horometer_unit?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Tipos de maquinaria
// ---------------------------------------------------------------------------
export interface MachineTypeResponse {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface CreateMachineTypeCommand {
  name: string;
  description?: string | null;
  performed_by?: string;
}

export interface CreateMaintenancePlanCommand {
  machine_id: string;
  component_name: string;
  interval_value: number;
  basis?: MaintenancePlanBasis;
  spare_part_id?: string | null;
  last_service_value?: number | null;
  warning_threshold?: number;
  notes?: string | null;
}
