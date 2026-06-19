from fastapi import APIRouter, Depends, HTTPException, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import get_current_user_metadata, require_roles
from src.features.user.application.dtos import (
    CreateAdminCommand,
    CreateOrUpdateUserMetadataCommand,
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

router = APIRouter(prefix="/user-metadata", tags=["User Metadata"])

# =============================================================================
# Clave de creación del administrador (HARDCODEADA).
# Quien conozca esta clave puede crear un usuario con rol Administrador desde la
# página pública /setup-admin, sin necesidad de un administrador previo ni JWT.
# Cámbiala por una cadena privada antes de exponer el sistema en producción.
# =============================================================================
ADMIN_CREATION_KEY = "SGMM-CLAVE-ADMIN-2026"


@router.post(
    "/create-admin",
    response_model=UserMetadataResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin(
    command: CreateAdminCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> UserMetadataResponse:
    """Crea (o promueve) un usuario como Administrador validando la clave de creación.

    Endpoint público gobernado por una clave estática (`ADMIN_CREATION_KEY`):
    no requiere JWT ni un administrador previo. Devuelve HTTP 403 si la clave
    es incorrecta.
    """
    if command.creation_key != ADMIN_CREATION_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clave de creación inválida.",
        )

    repo = UserRepository(uow)
    service = UserMetadataDomainService(repo)
    use_case = CreateOrUpdateUserMetadataUseCase(service, uow)
    inner = CreateOrUpdateUserMetadataCommand(
        better_auth_user_id=command.better_auth_user_id,
        role=UserRole.ADMINISTRADOR,
        hourly_rate=command.hourly_rate,
        performed_by="admin-setup",
    )
    return await use_case.execute(inner)


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
