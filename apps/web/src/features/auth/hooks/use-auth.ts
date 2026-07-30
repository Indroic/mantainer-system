import { authClient } from "@/lib/auth-client";
import type { UserRole } from "../types";

/**
 * Normaliza el rol del usuario de Better Auth a las claves del frontend.
 *
 * Acepta el alias heredado "admin" y las etiquetas antiguas en español para que
 * una sesión abierta con una cuenta aún sin migrar no pierda sus permisos.
 */
function normalizeRole(rawRole: string | null | undefined): UserRole | null {
  if (!rawRole) return null;
  const normalized = rawRole
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quita acentos ("mecánico" -> "mecanico")

  const aliases: Record<string, UserRole> = {
    // Planificador (antes Administrador).
    planner: "planner",
    planificador: "planner",
    admin: "planner",
    administrador: "planner",
    // Supervisor.
    supervisor: "supervisor",
    // Mecánico.
    mechanic: "mechanic",
    mecanico: "mechanic",
    // Almacén.
    warehouse: "warehouse",
    almacen: "warehouse",
  };

  return aliases[normalized] ?? null;
}

/** Etiqueta en español para mostrar en la UI (los roles internos son en inglés). */
const ROLE_LABELS: Record<UserRole, string> = {
  planner: "Planificador",
  supervisor: "Supervisor",
  mechanic: "Mecánico",
  warehouse: "Almacén",
};

export function useAuth() {
  // El rol proviene del usuario de Better Auth (plugin admin) y viaja en la sesión.
  const { data: sessionData, isPending, error } = authClient.useSession();

  const user = sessionData?.user ?? null;
  const isAuthenticated = !!user;
  const role: UserRole | null = normalizeRole((user as { role?: string } | null)?.role);

  const isPlanner = role === "planner";
  const isSupervisor = role === "supervisor";
  const isMechanic = role === "mechanic";
  const isWarehouse = role === "warehouse";

  return {
    user,
    session: sessionData?.session ?? null,
    isAuthenticated,
    isLoading: isPending,
    role,
    roleLabel: role ? ROLE_LABELS[role] : null,
    /** Nombre de usuario con el que inició sesión (spec 6.1). */
    username:
      (user as { displayUsername?: string | null; username?: string | null } | null)
        ?.displayUsername ??
      (user as { username?: string | null } | null)?.username ??
      null,

    isPlanner,
    isSupervisor,
    isMechanic,
    isWarehouse,

    // ---------------------------------------------------------------------
    // Capacidades derivadas. Centralizarlas evita que cada pantalla reinvente
    // la regla de permisos y se desincronice del backend.
    // ---------------------------------------------------------------------
    /** Solo el Planificador gestiona inventario y asigna repuestos (spec 2.1). */
    canManageInventory: isPlanner,
    canAssignSpareParts: isPlanner,
    /** El Supervisor y el Mecánico pueden crear OT (spec 2.2). */
    canCreateOrders: isPlanner || isSupervisor || isMechanic,
    /** Quién ejecuta trabajo de taller. */
    canExecuteOrders: isPlanner || isSupervisor || isMechanic,
    /** Información financiera y analítica. */
    canViewReports: isPlanner || isSupervisor,
    canViewFinancials: isPlanner || isSupervisor,
    /** Almacén ve el stock global y la bandeja de despacho (spec 2.3). */
    canViewInventory: isPlanner || isSupervisor || isMechanic || isWarehouse,
    canViewSolvencies: isPlanner || isSupervisor || isMechanic || isWarehouse,
    /** Almacén (y el Planificador) confirman la entrega de piezas. */
    canDispatchSolvencies: isWarehouse || isPlanner,
    canManageMachines: isPlanner || isSupervisor,
    canImportMachines: isPlanner,
    canViewAudit: isPlanner,
    canManageUsers: isPlanner,

    hasRole: (allowedRoles: UserRole[]) => role !== null && allowedRoles.includes(role),
    error,
  };
}
