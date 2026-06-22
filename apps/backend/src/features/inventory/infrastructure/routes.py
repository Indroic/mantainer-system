from fastapi import APIRouter, Depends, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
from src.features.inventory.application.dtos import (
    CreateSparePartCommand,
    SoftDeleteSparePartCommand,
    SparePartResponse,
    UpdateSparePartStockCommand,
)
from src.features.inventory.application.use_cases.create_spare_part import (
    CreateSparePartUseCase,
)
from src.features.inventory.application.use_cases.query_spare_parts import (
    QuerySparePartsUseCase,
)
from src.features.inventory.application.use_cases.soft_delete import (
    SoftDeleteSparePartUseCase,
)
from src.features.inventory.application.use_cases.update_stock import (
    UpdateSparePartStockUseCase,
)
from src.features.inventory.domain.services import InventoryDomainService
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.user.domain.entities import UserRole
from src.shared.infrastructure.database.db import get_uow

from src.features.user.application.dtos import UserMetadataResponse

router = APIRouter(prefix="/inventory", tags=["Inventory & Spare Parts"])


@router.post(
    "/",
    response_model=SparePartResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_spare_part(
    command: CreateSparePartCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> SparePartResponse:
    """Registra una nueva pieza o repuesto en el inventario.

    Restringido a Administradores y Supervisores.
    """
    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)
    use_case = CreateSparePartUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/stock",
    response_model=SparePartResponse,
)
async def update_stock(
    command: UpdateSparePartStockCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> SparePartResponse:
    """Actualiza manualmente el stock físico disponible de una pieza.

    Restringido a Administradores y Supervisores.
    """
    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)
    use_case = UpdateSparePartStockUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.delete(
    "/{spare_part_id}",
    response_model=SparePartResponse,
)
async def soft_delete_spare_part(
    spare_part_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> SparePartResponse:
    """Realiza la baja lógica (Soft Delete) de una pieza en el inventario.

    Restringido a Administradores y Supervisores.
    """
    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)
    use_case = SoftDeleteSparePartUseCase(service, uow)

    from uuid import UUID

    command = SoftDeleteSparePartCommand(
        spare_part_id=UUID(spare_part_id),
        performed_by=current_user.better_auth_user_id
    )
    return await use_case.execute(command)


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def query_spare_parts(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina los repuestos de manera dinámica.

    Permitido para todos los roles autorizados.
    """
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    return await use_case.execute(query)


@router.get(
    "/",
    response_model=list[SparePartResponse],
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_spare_parts(
    search: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[SparePartResponse]:
    """Obtiene la lista de todas las piezas del inventario, opcionalmente filtradas por término de búsqueda."""
    from hexcore.application.dtos.query import QueryRequestDTO
    
    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        search=search,
        search_fields=["code", "name"],
        filters=[]
    )
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    result = await use_case.execute(query_dto)
    return [
        SparePartResponse(
            id=sp.id,
            code=sp.code,
            name=sp.name,
            stock_minimum=sp.stock_minimum,
            unit_cost=sp.unit_cost,
            stock_current=sp.stock_current,
            created_at=sp.created_at,
            updated_at=sp.updated_at,
            is_active=sp.is_active,
        )
        for sp in result.items
    ]


