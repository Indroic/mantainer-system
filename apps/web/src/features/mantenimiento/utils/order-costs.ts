import type { MaintenanceOrderResponse, OrderSparePartResponse } from "../types";

/**
 * Utilidades defensivas para los costos de repuestos de una Orden de Trabajo.
 *
 * El backend define `unit_cost_at_time` como `float | None`: el costo histórico
 * SOLO se congela al liquidar la OT (ver `MaintenanceDomainService.liquidate_order`).
 * Mientras la OT está PROGRAMADO/EN_EJECUCION el campo llega como `null`, y
 * `quantity` es un alias opcional de `quantity_requested` que algunos endpoints
 * no rellenan. Acceder directamente a esos valores (`item.unit_cost_at_time.toFixed()`)
 * rompía la pantalla de Ejecución de Mantenimiento al asignar un repuesto.
 *
 * Estas funciones normalizan siempre a número y distinguen el costo histórico
 * congelado del costo estimado tomado del catálogo vigente.
 */

/** Devuelve la lista de repuestos de la OT, tolerando `null`/`undefined`. */
export function orderSpareParts(
  order: Pick<MaintenanceOrderResponse, "spare_parts"> | null | undefined,
): OrderSparePartResponse[] {
  const parts = order?.spare_parts;
  return Array.isArray(parts) ? parts.filter(Boolean) : [];
}

/** Cantidad solicitada del repuesto, con respaldo en `quantity_requested`. */
export function sparePartQuantity(item: OrderSparePartResponse | null | undefined): number {
  const raw = item?.quantity ?? item?.quantity_requested;
  return Number.isFinite(Number(raw)) ? Number(raw) : 0;
}

export interface SparePartUnitCost {
  /** Valor numérico seguro, nunca `NaN`. */
  value: number;
  /**
   * `true` cuando el costo proviene de `unit_cost_at_time` (congelado al
   * liquidar). `false` cuando es una estimación del catálogo vigente.
   */
  isHistorical: boolean;
}

/**
 * Costo unitario del repuesto. Si aún no hay costo histórico congelado, estima
 * con el costo vigente del catálogo (USD si existe) para no mostrar 0,00.
 */
export function sparePartUnitCost(
  item: OrderSparePartResponse | null | undefined,
): SparePartUnitCost {
  const historical = item?.unit_cost_at_time;
  if (historical !== null && historical !== undefined && Number.isFinite(Number(historical))) {
    return { value: Number(historical), isHistorical: true };
  }

  const catalog = item?.spare_part?.unit_cost_usd ?? item?.spare_part?.unit_cost;
  return {
    value: Number.isFinite(Number(catalog)) ? Number(catalog) : 0,
    isHistorical: false,
  };
}

/** Subtotal (cantidad x costo unitario) seguro para un repuesto. */
export function sparePartSubtotal(item: OrderSparePartResponse | null | undefined): number {
  return sparePartQuantity(item) * sparePartUnitCost(item).value;
}

/** Sumatoria del costo de repuestos de una OT, tolerante a datos incompletos. */
export function orderSparePartsTotal(
  order: Pick<MaintenanceOrderResponse, "spare_parts"> | null | undefined,
): number {
  return orderSpareParts(order).reduce((acc, item) => acc + sparePartSubtotal(item), 0);
}

/** Formatea un valor monetario tolerando `null`, `undefined` y `NaN`. */
export function formatCurrency(value: number | null | undefined): string {
  const numeric = Number(value);
  return `$${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`;
}
