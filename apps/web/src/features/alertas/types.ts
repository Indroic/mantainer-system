export interface AlertNotification {
  id: string;
  type: "STOCK_BAJO" | "MANTENIMIENTO_CERCANO" | "MANTENIMIENTO_VENCIDO";
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  created_at: string;
}
