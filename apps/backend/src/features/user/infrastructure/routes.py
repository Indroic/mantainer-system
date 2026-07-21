from fastapi import APIRouter, Depends, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    CurrentUser,
    _parse_role,
    get_current_user,
    require_roles,
)
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
from src.features.user.domain.entities import UserMetadata, UserRole
from src.features.user.domain.services import UserMetadataDomainService
from src.features.user.infrastructure.repositories import UserRepository
from src.shared.infrastructure.database.db import get_uow
from src.shared.infrastructure.database.user_lookup import (
    list_users_with_roles,
    resolve_user_names,
)

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

    La fuente de verdad de usuarios y roles es Better Auth (tabla ``user``), no
    la tabla local ``user_metadata``. Por eso leemos los mecánicos directamente
    de Better Auth y, de forma idempotente, aseguramos que exista su fila en
    ``user_metadata`` (cuyo ``id`` UUID es el que referencian las OT en
    ``assigned_mechanic_id``). Así el selector se rellena automáticamente en
    cuanto se crea un mecánico, sin pasos manuales.

    Restringido a Administradores y Supervisores (mismo criterio que programar OT).
    """
    # 1) Mecánicos según Better Auth (rol normalizado, robusto a idioma/mayúsculas).
    all_users = await list_users_with_roles(uow.session)
    ba_mechanics = [
        (uid, name)
        for (uid, name, role) in all_users
        if _parse_role(role) == UserRole.MECANICO
    ]

    if not ba_mechanics:
        return []

    # 2) Auto-provisión idempotente de user_metadata para obtener el UUID estable.
    repo = UserRepository(uow)
    response: list[MechanicResponse] = []
    async with uow:
        for better_auth_user_id, name in ba_mechanics:
            metadata = await repo.get_by_better_auth_id(better_auth_user_id)
            if metadata is None:
                metadata = UserMetadata(
                    better_auth_user_id=better_auth_user_id,
                    role=UserRole.MECANICO,
                    hourly_rate=0.0,
                )
                await repo.save(metadata)
            response.append(
                MechanicResponse(
                    id=metadata.id,
                    name=name or better_auth_user_id,
                )
            )
        await uow.commit()

    return response


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
