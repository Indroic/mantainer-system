export type MachineStatus = "ACTIVA" | "EN_MANTENIMIENTO" | "FUERA_DE_SERVICIO" | "DADA_DE_BAJA";
export type HorometerUnit = "Horas" | "Kilómetros" | "Millas";

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
