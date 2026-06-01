from fastapi import APIRouter, Depends, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.maintenance.application.dtos import (
    AddSparePartToOrderCommand,
    CreateMaintenanceCommand,
    LiquidateMaintenanceCommand,
    MaintenanceResponse,
    MaintenanceSparePartResponse,
    StartMaintenanceCommand,
)
from src.features.maintenance.application.use_cases.add_spare_part import (
    AddSparePartToOrderUseCase,
)
from src.features.maintenance.application.use_cases.create_order import (
    CreateMaintenanceUseCase,
)
from src.features.maintenance.application.use_cases.liquidate import (
    LiquidateMaintenanceUseCase,
)
from src.features.maintenance.application.use_cases.query_orders import (
    QueryMaintenanceOrdersUseCase,
)
from src.features.maintenance.application.use_cases.start_execution import (
    StartMaintenanceUseCase,
)
from src.features.maintenance.domain.services import MaintenanceDomainService
from src.features.maintenance.infrastructure.repositories import (
    MaintenanceOrderRepository,
)
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.user.domain.entities import UserRole
from src.features.user.infrastructure.repositories import UserRepository
from src.shared.infrastructure.database.db import get_uow

from src.features.user.application.dtos import UserMetadataResponse

router = APIRouter(prefix="/maintenance", tags=["Maintenance Orders"])


def get_maintenance_service(uow: SqlAlchemyUnitOfWork = Depends(get_uow)) -> MaintenanceDomainService:
    return MaintenanceDomainService(
        maintenance_repo=MaintenanceOrderRepository(uow),
        machine_repo=MachineRepository(uow),
        spare_part_repo=SparePartRepository(uow),
        user_metadata_repo=UserRepository(uow),
    )


@router.post(
    "/",
    response_model=MaintenanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    command: CreateMaintenanceCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> MaintenanceResponse:
    """Registra y programa una nueva orden de trabajo de mantenimiento.

    Restringido a Administradores y Supervisores.
    """
    use_case = CreateMaintenanceUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/start",
    response_model=MaintenanceResponse,
)
async def start_maintenance(
    command: StartMaintenanceCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MaintenanceResponse:
    """Cambia el estado de una orden de trabajo a EN_EJECUCION.

    Esto cambia automáticamente el estado de la máquina vinculada a
    EN_MANTENIMIENTO. Permitido para Administradores, Supervisores y Mecánicos.
    """
    use_case = StartMaintenanceUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.post(
    "/spare-parts",
    response_model=MaintenanceSparePartResponse,
)
async def add_spare_part(
    command: AddSparePartToOrderCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MaintenanceSparePartResponse:
    """Asocia repuestos requeridos a una orden de trabajo que esté EN_EJECUCION.

    Permitido para Administradores, Supervisores y Mecánicos.
    """
    use_case = AddSparePartToOrderUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/liquidate",
    response_model=MaintenanceResponse,
)
async def liquidate_maintenance(
    command: LiquidateMaintenanceCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MaintenanceResponse:
    """Liquida la orden de trabajo aplicando la transacción ACID.

    Descuenta físicamente el stock de repuestos en el inventario, calcula 
    el próximo servicio y devuelve la máquina vinculada a estado ACTIVA. 
    Permitido para Administradores, Supervisores y Mecánicos.
    """
    use_case = LiquidateMaintenanceUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
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
async def query_orders(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina órdenes de trabajo de mantenimiento.

    Permitido para todos los roles autorizados.
    """
    repo = MaintenanceOrderRepository(uow)
    use_case = QueryMaintenanceOrdersUseCase(repo)
    return await use_case.execute(query)
