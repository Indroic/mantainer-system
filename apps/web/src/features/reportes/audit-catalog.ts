/**
 * Catálogo de entidades y operaciones de la Bitácora de Auditoría Forense.
 *
 * Los filtros de la bitácora comparan por igualdad EXACTA contra la columna
 * correspondiente, así que las opciones del selector tienen que ser los valores
 * que el backend graba de verdad. Los antiguos filtros ofrecían `CREATE`,
 * `UPDATE` y `DELETE`: `UPDATE` y `DELETE` no existen como tales en la
 * bitácora (se registran `UPDATE_STOCK`, `UPDATE_HOROMETER`, `SOFT_DELETE`…),
 * por lo que esos dos filtros no devolvían NUNCA resultados.
 *
 * Esta tabla replica el catálogo del backend para poder pintar el selector sin
 * esperar red; la página, además, completa las opciones con las que llegan del
 * endpoint `/audit-logs/facets`, de modo que una operación nueva aparezca en el
 * filtro aunque aquí no esté declarada.
 */

/** Operaciones que el backend escribe en la bitácora. */
export const AUDIT_ACTIONS: { value: string; label: string }[] = [
  { value: "CREATE", label: "Creación" },
  { value: "CREATE_OR_UPDATE", label: "Creación o actualización" },
  { value: "SOFT_DELETE", label: "Baja lógica" },
  { value: "UPDATE_STOCK", label: "Ajuste de stock" },
  { value: "UPDATE_HOROMETER", label: "Actualización de horómetro" },
  { value: "CHANGE_STATUS", label: "Cambio de estado" },
  { value: "START_EXECUTION", label: "Inicio de ejecución" },
  { value: "LIQUIDATE", label: "Liquidación de OT" },
  { value: "ADD_SPARE_PART", label: "Asignación de repuesto" },
  { value: "RETURN_SPARE_PART", label: "Devolución de repuesto" },
  { value: "CREATE_MAINTENANCE_PLAN", label: "Alta de plan preventivo" },
  { value: "REGISTER_COMPONENT_SERVICE", label: "Servicio de componente" },
];

/** Entidades sobre las que se registran cambios. */
export const AUDIT_ENTITIES: { value: string; label: string }[] = [
  { value: "Machine", label: "Maquinarias" },
  { value: "MachineType", label: "Tipos de maquinaria" },
  { value: "SparePart", label: "Repuestos" },
  { value: "MaintenanceOrder", label: "Órdenes de Trabajo" },
  { value: "MaintenanceSparePart", label: "Repuestos de OT" },
  { value: "MaintenancePlan", label: "Planes preventivos" },
  { value: "UserMetadata", label: "Usuarios" },
];

const ACTION_LABELS = new Map(AUDIT_ACTIONS.map((a) => [a.value, a.label]));
const ENTITY_LABELS = new Map(AUDIT_ENTITIES.map((e) => [e.value, e.label]));

/** Etiqueta legible de una operación; si es desconocida se humaniza el código. */
export function auditActionLabel(action?: string | null): string {
  if (!action) return "—";
  return ACTION_LABELS.get(action) ?? action.replace(/_/g, " ").toLowerCase();
}

/** Etiqueta legible de una entidad; si es desconocida se devuelve tal cual. */
export function auditEntityLabel(entity?: string | null): string {
  if (!entity) return "—";
  return ENTITY_LABELS.get(entity) ?? entity;
}

/**
 * Clases de color del distintivo según la NATURALEZA de la operación.
 *
 * Se agrupa por familia (alta / baja / modificación / flujo de taller) en lugar
 * de listar códigos exactos: así una operación nueva del backend recibe un color
 * coherente en vez de quedarse sin estilo, como ocurría al comparar solo contra
 * CREATE / UPDATE / DELETE.
 */
export function auditActionTone(action?: string | null): string {
  const code = (action || "").toUpperCase();

  if (code.includes("DELETE") || code.includes("RETURN") || code.includes("CANCEL")) {
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  }
  if (code.startsWith("CREATE") || code.includes("ADD") || code.includes("REGISTER")) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  if (code.includes("LIQUIDATE") || code.includes("START") || code.includes("EXECUTION")) {
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  }
  if (code.includes("UPDATE") || code.includes("CHANGE")) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  return "bg-default/60 text-muted-foreground border-border";
}
