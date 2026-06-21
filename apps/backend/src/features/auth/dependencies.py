import unicodedata
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from src.features.auth.jwt_helper import decode_better_auth_jwt
from src.features.user.domain.entities import UserRole


@dataclass
class CurrentUser:
    """Usuario autenticado derivado del JWT de Better Auth (incluye el rol del plugin admin)."""

    better_auth_user_id: str
    role: UserRole | None = None
    email: str | None = None
    name: str | None = None


def _parse_role(raw: str | None) -> UserRole | None:
    """Normaliza el rol del JWT (acentos/mayúsculas) a un UserRole del dominio."""
    if not raw:
        return None
    normalized = "".join(
        c for c in unicodedata.normalize("NFD", str(raw)) if unicodedata.category(c) != "Mn"
    ).upper()
    mapping = {
        # Roles actuales de Better Auth (en inglés y cortos).
        "ADMIN": UserRole.ADMINISTRADOR,
        "SUPERVISOR": UserRole.SUPERVISOR,
        "MECHANIC": UserRole.MECANICO,
        # Compatibilidad con valores antiguos en español.
        "ADMINISTRADOR": UserRole.ADMINISTRADOR,
        "MECANICO": UserRole.MECANICO,
    }
    return mapping.get(normalized)


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
