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


async def _to_maintenance_response(order, uow: SqlAlchemyUnitOfWork) -> MaintenanceResponse:
    from src.features.machine.infrastructure.repositories import MachineRepository
    from src.features.inventory.infrastructure.repositories import SparePartRepository
    from src.features.machine.application.dtos import MachineResponse as MachineDTOResponse
    from src.features.inventory.application.dtos import SparePartResponse as SparePartDTOResponse
    from src.features.user.infrastructure.repositories import UserRepository
    from src.shared.infrastructure.database.user_lookup import resolve_user_names

    # 1. Obtener la Máquina asociada
    machine_repo = MachineRepository(uow)
    machine_dto = None
    try:
        machine = await machine_repo.get_by_id(order.machine_id)
        machine_dto = MachineDTOResponse(
            id=machine.id,
            code=machine.code,
            motor_serial=machine.motor_serial,
            brand=machine.brand,
            model=machine.model,
            manufacture_year=machine.manufacture_year,
            current_horometer=machine.current_horometer,
            status=machine.status,
            horometer_unit=getattr(machine, 'horometer_unit', 'Horas'),
            description=getattr(machine, 'description', None),
            location=getattr(machine, 'location', None),
            created_at=machine.created_at,
            updated_at=machine.updated_at,
            is_active=machine.is_active,
        )
    except Exception:
        pass

    # 2. Resolver nombre del mecánico asignado
    mechanic_name: str | None = None
    try:
        user_repo = UserRepository(uow)
        mechanic_metadata = await user_repo.get_by_id(order.assigned_mechanic_id)
        names = await resolve_user_names(uow.session, [mechanic_metadata.better_auth_user_id])
        mechanic_name = names.get(mechanic_metadata.better_auth_user_id)
    except Exception:
        pass

    # 3. Obtener y mapear repuestos
    part_repo = SparePartRepository(uow)
    spare_parts_dtos = []
    for sp in order.spare_parts:
        part_dto = None
        try:
            part = await part_repo.get_by_id(sp.spare_part_id)
            part_dto = SparePartDTOResponse(
                id=part.id,
                code=part.code,
                name=part.name,
                stock_minimum=part.stock_minimum,
                unit_cost=part.unit_cost,
                stock_current=part.stock_current,
                created_at=part.created_at,
                updated_at=part.updated_at,
                is_active=part.is_active,
            )
        except Exception:
            pass

        spare_parts_dtos.append(
            MaintenanceSparePartResponse(
                id=sp.id,
                spare_part_id=sp.spare_part_id,
                quantity_requested=sp.quantity_requested,
                quantity=sp.quantity_requested,
                unit_cost_at_time=sp.unit_cost_at_time,
                spare_part=part_dto,
            )
        )

    return MaintenanceResponse(
        id=order.id,
        machine_id=order.machine_id,
        description=order.description,
        status=order.status,
        assigned_mechanic_id=order.assigned_mechanic_id,
        assigned_mechanic_name=mechanic_name,
        next_service_horometer=order.next_service_horometer,
        spare_parts=spare_parts_dtos,
        machine=machine_dto,
        created_at=order.created_at,
        updated_at=order.updated_at,
        is_active=order.is_active,
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
    res = await use_case.execute(command)
    
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(res.id)
    return await _to_maintenance_response(order, uow)


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
    res = await use_case.execute(command)
    
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(res.id)
    return await _to_maintenance_response(order, uow)


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
    res = await use_case.execute(command)
    
    part_repo = SparePartRepository(uow)
    part = await part_repo.get_by_id(res.spare_part_id)
    from src.features.inventory.application.dtos import SparePartResponse as SparePartDTOResponse
    part_dto = SparePartDTOResponse(
        id=part.id,
        code=part.code,
        name=part.name,
        stock_minimum=part.stock_minimum,
        unit_cost=part.unit_cost,
        stock_current=part.stock_current,
        created_at=part.created_at,
        updated_at=part.updated_at,
        is_active=part.is_active,
    )
    return MaintenanceSparePartResponse(
        id=res.id,
        spare_part_id=res.spare_part_id,
        quantity_requested=res.quantity_requested,
        quantity=res.quantity_requested,
        unit_cost_at_time=res.unit_cost_at_time,
        spare_part=part_dto,
    )


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
    res = await use_case.execute(command)
    
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(res.id)
    return await _to_maintenance_response(order, uow)


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


@router.get(
    "/",
    response_model=list[MaintenanceResponse],
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_orders(
    status: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[MaintenanceResponse]:
    """Obtiene la lista de todas las órdenes de trabajo, opcionalmente filtradas por estado."""
    from hexcore.application.dtos.query import QueryRequestDTO, FilterConditionDTO, FilterOperator
    
    filters = []
    if status:
        filters.append(FilterConditionDTO(field="status", operator=FilterOperator.EQ, value=status))
        
    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        filters=filters
    )
    repo = MaintenanceOrderRepository(uow)
    use_case = QueryMaintenanceOrdersUseCase(repo)
    result = await use_case.execute(query_dto)
    
    orders_dtos = []
    for o in result.items:
        orders_dtos.append(await _to_maintenance_response(o, uow))
    return orders_dtos


@router.get(
    "/{order_id}",
    response_model=MaintenanceResponse,
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_order(
    order_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> MaintenanceResponse:
    """Obtiene una orden de trabajo específica por su ID, de forma totalmente hidratada."""
    from uuid import UUID
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(UUID(order_id))
    return await _to_maintenance_response(order, uow)


@router.post(
    "/{order_id}/start",
    response_model=MaintenanceResponse,
)
async def start_maintenance_path(
    order_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MaintenanceResponse:
    """Cambia el estado de una orden de trabajo a EN_EJECUCION utilizando parámetros en la URL."""
    from uuid import UUID
    command = StartMaintenanceCommand(
        order_id=UUID(order_id),
        performed_by=current_user.better_auth_user_id
    )
    use_case = StartMaintenanceUseCase(service, uow)
    await use_case.execute(command)
    
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(UUID(order_id))
    return await _to_maintenance_response(order, uow)


@router.post(
    "/{order_id}/spare-parts",
    response_model=MaintenanceResponse,
)
async def add_spare_part_path(
    order_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MaintenanceResponse:
    """Asocia un repuesto requerido a una orden de trabajo utilizando parámetros en la URL y retorna el estado actualizado de la orden."""
    from uuid import UUID
    command = AddSparePartToOrderCommand(
        order_id=UUID(order_id),
        spare_part_id=UUID(payload["spare_part_id"]),
        quantity=int(payload["quantity"]),
        performed_by=current_user.better_auth_user_id
    )
    use_case = AddSparePartToOrderUseCase(service, uow)
    await use_case.execute(command)
    
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(UUID(order_id))
    return await _to_maintenance_response(order, uow)


@router.post(
    "/{order_id}/liquidate",
    response_model=MaintenanceResponse,
)
async def liquidate_maintenance_path(
    order_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: MaintenanceDomainService = Depends(get_maintenance_service),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MaintenanceResponse:
    """Liquida la orden de trabajo desde el frontend, actualizando primero el horómetro de la máquina si se proporciona."""
    from uuid import UUID
    
    current_horometer = payload.get("current_horometer")
    if current_horometer is not None:
        order_repo = MaintenanceOrderRepository(uow)
        order = await order_repo.get_by_id(UUID(order_id))
        
        from src.features.machine.infrastructure.repositories import MachineRepository
        from src.features.machine.domain.services import MachineDomainService
        from src.features.machine.application.use_cases.update_horometer import UpdateMachineHorometerUseCase
        from src.features.machine.application.dtos import UpdateMachineHorometerCommand
        
        machine_repo = MachineRepository(uow)
        machine_service = MachineDomainService(machine_repo)
        update_horometer_use_case = UpdateMachineHorometerUseCase(machine_service, uow)
        
        horometer_cmd = UpdateMachineHorometerCommand(
            machine_id=order.machine_id,
            new_horometer=float(current_horometer),
            performed_by=current_user.better_auth_user_id
        )
        await update_horometer_use_case.execute(horometer_cmd)

    command = LiquidateMaintenanceCommand(
        order_id=UUID(order_id),
        performed_by=current_user.better_auth_user_id
    )
    use_case = LiquidateMaintenanceUseCase(service, uow)
    await use_case.execute(command)
    
    repo = MaintenanceOrderRepository(uow)
    order = await repo.get_by_id(UUID(order_id))
    return await _to_maintenance_response(order, uow)

