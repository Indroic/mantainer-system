from collections.abc import Callable
from fastapi import Depends, Header, HTTPException, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.jwt_helper import decode_better_auth_jwt
from src.features.user.application.dtos import UserMetadataResponse
from src.features.user.application.use_cases.get_user_metadata import (
    GetUserMetadataByBetterAuthIdUseCase,
)
from src.features.user.domain.entities import UserRole
from src.features.user.domain.exceptions import UserMetadataNotFoundException
from src.features.user.domain.services import UserMetadataDomainService
from src.features.user.infrastructure.repositories import UserRepository
from src.shared.infrastructure.database.db import get_uow


def get_current_user_id(authorization: str = Header(..., description="Bearer token JWT")) -> str:
    """Extrae y valida el JWT de Better Auth para obtener el ID de usuario."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de cabecera de autorización inválido. Debe ser 'Bearer <token>'.",
        )
    token = authorization.split(" ")[1]
    payload = decode_better_auth_jwt(token)
    return payload["better_auth_user_id"]


async def get_current_user_metadata(
    better_auth_user_id: str = Depends(get_current_user_id),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> UserMetadataResponse:
    """Obtiene la metadata local del usuario autenticado por Better Auth."""
    repo = UserRepository(uow)
    service = UserMetadataDomainService(repo)
    use_case = GetUserMetadataByBetterAuthIdUseCase(service, uow)
    try:
        return await use_case.execute(better_auth_user_id)
    except UserMetadataNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Metadata de usuario no registrada en el backend local. Contacte al administrador.",
        )


def require_roles(allowed_roles: list[UserRole]) -> Callable:
    """Generador de dependencias para validar que el usuario tenga un rol permitido."""

    def dependency(user: UserMetadataResponse = Depends(get_current_user_metadata)) -> UserMetadataResponse:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los siguientes roles: {[r.value for r in allowed_roles]}",
            )
        return user

    return dependency
