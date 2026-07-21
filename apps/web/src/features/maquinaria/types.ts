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
