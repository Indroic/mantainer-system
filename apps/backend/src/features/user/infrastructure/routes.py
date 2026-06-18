from fastapi import APIRouter, Depends, HTTPException, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    get_current_user_id,
    get_current_user_metadata,
    require_roles,
)
from src.features.user.application.dtos import (
    BootstrapAdminCommand,
    CreateOrUpdateUserMetadataCommand,
    UserMetadataResponse,
)
from src.features.user.application.use_cases.bootstrap_admin import (
    BootstrapInitialAdminUseCase,
)
from src.features.user.application.use_cases.create_or_update_metadata import (
    CreateOrUpdateUserMetadataUseCase,
)
from src.features.user.application.use_cases.get_user_metadata import (
    GetUserMetadataByBetterAuthIdUseCase,
)
from src.features.user.domain.entities import UserRole
from src.features.user.domain.exceptions import AdminAlreadyExistsException
from src.features.user.domain.services import UserMetadataDomainService
from src.features.user.infrastructure.repositories import UserRepository
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/user-metadata", tags=["User Metadata"])


@router.get("/admin-exists", response_model=dict)
async def admin_exists(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> dict:
    """Indica si ya existe un administrador en el sistema (endpoint público).

    Útil para que el frontend decida si debe mostrar la pantalla de
    configuración inicial del administrador.
    """
    repo = UserRepository(uow)
    return {"admin_exists": await repo.exists_any_admin()}


@router.post(
    "/bootstrap-admin",
    response_model=UserMetadataResponse,
    status_code=status.HTTP_201_CREATED,
)
async def bootstrap_admin(
    command: BootstrapAdminCommand,
    better_auth_user_id: str = Depends(get_current_user_id),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> UserMetadataResponse:
    """Registra al administrador inicial del sistema.

    Solo requiere un JWT válido de Better Auth (no un rol previo). Falla con
    HTTP 409 si ya existe algún administrador. El usuario promovido es el dueño
    del token, no un ID enviado por el cliente.
    """
    repo = UserRepository(uow)
    service = UserMetadataDomainService(repo)
    use_case = BootstrapInitialAdminUseCase(service, uow)
    command.better_auth_user_id = better_auth_user_id
    try:
        return await use_case.execute(command)
    except AdminAlreadyExistsException as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.post(
    "/",
    response_model=UserMetadataResponse,
    status_code=status.HTTP_200_OK,
)
async def create_or_update_metadata(
    command: CreateOrUpdateUserMetadataCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR])),
) -> UserMetadataResponse:
    """Registra o actualiza la metadata local de un usuario (roles y tarifas horarias).

    Restringido al rol Administrador.
    """
    repo = UserRepository(uow)
    service = UserMetadataDomainService(repo)
    use_case = CreateOrUpdateUserMetadataUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.get("/me", response_model=UserMetadataResponse)
async def get_my_metadata(
    current_user: UserMetadataResponse = Depends(get_current_user_metadata),
) -> UserMetadataResponse:
    """Obtiene la metadata local del usuario autenticado actual."""
    return current_user


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
