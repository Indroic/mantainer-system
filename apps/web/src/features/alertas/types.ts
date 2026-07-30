// ---------------------------------------------------------------------------
// Notificaciones dirigidas emitidas por el backend (spec 2.2 / 3.1 / 3.2 / 3.3)
//
// El enrutado y el filtrado por rol ocurren en el servidor: el Mecánico nunca
// recibe avisos de bajo stock. El frontend solo pinta lo que le llega.
// ---------------------------------------------------------------------------
export type NotificationType =
  | "OT_CREADA"
  | "OT_LIQUIDADA"
  | "SOLVENCIA_EMITIDA"
  | "BAJO_STOCK"
  | "MANTENIMIENTO_PROXIMO"
  | "SERVICIO_COMPONENTE";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  is_read: boolean;
  link?: string | null;
  related_entity_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface NotificationInboxResponse {
  unread_count: number;
  items: NotificationResponse[];
}

// ---------------------------------------------------------------------------
// Alertas del sistema (barrido de inventario, maquinaria y planes preventivos)
// ---------------------------------------------------------------------------
export type AlertType = "LOW_STOCK" | "MAINTENANCE_DUE" | "COMPONENT_SERVICE_DUE";

export interface AlertResponse {
  id: string;
  machine_id?: string | null;
  spare_part_id?: string | null;
  maintenance_plan_id?: string | null;
  type: AlertType;
  message: string;
  is_resolved: boolean;
  created_at: string;
  updated_at?: string;
}
