from fastapi import APIRouter, Depends, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import CurrentUser, get_current_user, require_roles
from src.features.user.application.dtos import (
    CreateOrUpdateUserMetadataCommand,
    MechanicResponse,
    UserMetadataResponse,
)
from src.features.user.application.use_cases.create_or_update_metadata import (
    CreateOrUpdateUserMetadataUseCase,
)
from src.features.user.application.use_cases.get_user_metadata import (
    GetUserMetadataByBetterAuthIdUseCase,
)
from src.features.user.domain.entities import UserRole
from src.features.user.domain.services import UserMetadataDomainService
from src.features.user.infrastructure.repositories import UserRepository
from src.shared.infrastructure.database.db import get_uow
from src.shared.infrastructure.database.user_lookup import resolve_user_names

router = APIRouter(prefix="/user-metadata", tags=["User Metadata"])


@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)) -> dict:
    """Devuelve el usuario autenticado y su rol, leídos del JWT de Better Auth."""
    return {
        "better_auth_user_id": current_user.better_auth_user_id,
        "role": current_user.role.value if current_user.role else None,
        "email": current_user.email,
        "name": current_user.name,
    }


@router.post(
    "/",
    response_model=UserMetadataResponse,
    status_code=status.HTTP_200_OK,
)
async def create_or_update_metadata(
    command: CreateOrUpdateUserMetadataCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: CurrentUser = Depends(require_roles([UserRole.ADMINISTRADOR])),
) -> UserMetadataResponse:
    """Registra o actualiza metadata local de un usuario (p. ej. tarifa horaria).

    Restringido al rol Administrador. El rol del usuario se gestiona en Better Auth.
    """
    repo = UserRepository(uow)
    service = UserMetadataDomainService(repo)
    use_case = CreateOrUpdateUserMetadataUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.get(
    "/mechanics",
    response_model=list[MechanicResponse],
    dependencies=[
        Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))
    ],
)
async def list_mechanics(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[MechanicResponse]:
    """Lista los usuarios con rol Mecánico, para poblar selectores de asignación.

    Restringido a Administradores y Supervisores (mismo criterio que programar OT).
    """
    repo = UserRepository(uow)
    mechanics = await repo.list_by_role(UserRole.MECANICO)

    names = await resolve_user_names(uow.session, [m.better_auth_user_id for m in mechanics])

    return [
        MechanicResponse(id=m.id, name=names.get(m.better_auth_user_id, m.better_auth_user_id))
        for m in mechanics
    ]


@router.get(
    "/{better_auth_user_id}",
    response_model=UserMetadataResponse,
    dependencies=[
        Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))
    ],
)
async def get_user_metadata_by_id(
    better_auth_user_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> UserMetadataResponse:
    """Busca la metadata local de cualquier usuario por su ID de Better Auth.

    Restringido a Administradores y Supervisores.
    """
    repo = UserRepository(uow)
    service = UserMetadataDomainService(repo)
    use_case = GetUserMetadataByBetterAuthIdUseCase(service, uow)
    return await use_case.execute(better_auth_user_id)
