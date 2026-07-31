from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from src.features.auth.jwt_helper import decode_better_auth_jwt
from src.features.user.domain.entities import UserRole

# =============================================================================
# Conjuntos de roles reutilizables por los routers.
#
# Definirlos en un solo lugar evita que las listas de permisos se desincronicen
# entre endpoints al cambiar las reglas de negocio.
# =============================================================================

#: Único rol autorizado a gestionar inventario y a asignar repuestos a las OT.
PLANNER_ONLY = [UserRole.PLANIFICADOR]

#: Roles que pueden crear Órdenes de Trabajo (el Planificador también, para poder
#: registrar trabajo planificado sin depender de otro usuario).
CAN_CREATE_ORDERS = [UserRole.PLANIFICADOR, UserRole.SUPERVISOR, UserRole.MECANICO]

#: Roles que ejecutan trabajo de taller (iniciar / liquidar OT).
CAN_EXECUTE_ORDERS = [UserRole.PLANIFICADOR, UserRole.SUPERVISOR, UserRole.MECANICO]

#: Roles con visibilidad sobre el inventario (Almacén incluido: consulta stock global).
CAN_VIEW_INVENTORY = [
    UserRole.PLANIFICADOR,
    UserRole.SUPERVISOR,
    UserRole.MECANICO,
    UserRole.ALMACEN,
]

#: Roles que pueden registrar nuevos repuestos en el inventario (Almacén incluido:
#: da de alta piezas, pero no ajusta stock/precio ni da de baja).
CAN_CREATE_SPARE_PARTS = [UserRole.PLANIFICADOR, UserRole.ALMACEN]

#: Roles que administran el catálogo de maquinaria (altas, estados, bajas).
CAN_MANAGE_MACHINES = [UserRole.PLANIFICADOR, UserRole.SUPERVISOR]

#: Roles con visibilidad de solo lectura sobre el catálogo de maquinaria (Almacén
#: incluido: consulta el activo desde la Solvencia, pero no lo gestiona).
CAN_VIEW_MACHINES = [
    UserRole.PLANIFICADOR,
    UserRole.SUPERVISOR,
    UserRole.MECANICO,
    UserRole.ALMACEN,
]

#: Roles con visibilidad de solo lectura sobre el flujo de Órdenes de Trabajo
#: (Almacén incluido: consulta el estado de la OT que originó la Solvencia).
CAN_VIEW_MAINTENANCE = [
    UserRole.PLANIFICADOR,
    UserRole.SUPERVISOR,
    UserRole.MECANICO,
    UserRole.ALMACEN,
]

#: Roles con acceso a información financiera / analítica.
CAN_VIEW_REPORTS = [UserRole.PLANIFICADOR, UserRole.SUPERVISOR]

#: Roles que pueden resolver alertas (Almacén resuelve las de bajo stock).
CAN_RESOLVE_ALERTS = [UserRole.PLANIFICADOR, UserRole.SUPERVISOR, UserRole.ALMACEN]

#: Roles que ven la bandeja de despacho de Solvencias de Repuestos.
CAN_VIEW_SOLVENCIES = [
    UserRole.PLANIFICADOR,
    UserRole.SUPERVISOR,
    UserRole.MECANICO,
    UserRole.ALMACEN,
]

#: Todos los roles autenticados del sistema.
ALL_ROLES = [
    UserRole.PLANIFICADOR,
    UserRole.SUPERVISOR,
    UserRole.MECANICO,
    UserRole.ALMACEN,
]


@dataclass
class CurrentUser:
    """Usuario autenticado derivado del JWT de Better Auth (incluye el rol del plugin admin)."""

    better_auth_user_id: str
    role: UserRole | None = None
    email: str | None = None
    name: str | None = None
    username: str | None = None


def _parse_role(raw: str | None) -> UserRole | None:
    """Normaliza el rol del JWT (acentos/mayúsculas/idioma) a un ``UserRole``.

    Toda la tabla de alias (incluida la compatibilidad con el antiguo
    ``admin``/``Administrador``) vive en ``UserRole._missing_``.
    """
    if not raw:
        return None
    try:
        return UserRole(raw)
    except ValueError:
        return None


def _token_from_header(authorization: str) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de cabecera de autorización inválido. Debe ser 'Bearer <token>'.",
        )
    return authorization.split(" ")[1]


def get_current_user(
    authorization: str = Header(..., description="Bearer token JWT"),
) -> CurrentUser:
    """Extrae y valida el JWT de Better Auth, devolviendo el usuario actual y su rol."""
    token = _token_from_header(authorization)
    claims = decode_better_auth_jwt(token)
    return CurrentUser(
        better_auth_user_id=claims["better_auth_user_id"],
        role=_parse_role(claims.get("role")),
        email=claims.get("email"),
        name=claims.get("name"),
        username=claims.get("username") or claims.get("displayUsername"),
    )


def get_current_user_id(authorization: str = Header(..., description="Bearer token JWT")) -> str:
    """Devuelve solo el ID de Better Auth del usuario autenticado."""
    return get_current_user(authorization).better_auth_user_id


def require_roles(allowed_roles: list[UserRole]) -> Callable:
    """Genera una dependencia que valida que el rol del JWT esté permitido."""

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los siguientes roles: {[r.value for r in allowed_roles]}",
            )
        return user

    return dependency
