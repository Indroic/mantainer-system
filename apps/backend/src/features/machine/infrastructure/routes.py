from fastapi import APIRouter, Depends, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
from src.features.user.application.dtos import UserMetadataResponse
from src.features.machine.application.dtos import (
    ChangeMachineStatusCommand,
    CreateMachineCommand,
    MachineResponse,
    SoftDeleteMachineCommand,
    UpdateMachineHorometerCommand,
)
from src.features.machine.application.use_cases.change_status import (
    ChangeMachineStatusUseCase,
)
from src.features.machine.application.use_cases.create_machine import (
    CreateMachineUseCase,
)
from src.features.machine.application.use_cases.query_machines import (
    QueryMachinesUseCase,
)
from src.features.machine.application.use_cases.soft_delete import (
    SoftDeleteMachineUseCase,
)
from src.features.machine.application.use_cases.update_horometer import (
    UpdateMachineHorometerUseCase,
)
from src.features.machine.domain.services import MachineDomainService
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.user.domain.entities import UserRole
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/machines", tags=["Machines"])


@router.post(
    "/",
    response_model=MachineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_machine(
    command: CreateMachineCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> MachineResponse:
    """Registra una nueva máquina activa en el sistema.

    Restringido a Administradores y Supervisores.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = CreateMachineUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/horometer",
    response_model=MachineResponse,
)
async def update_horometer(
    command: UpdateMachineHorometerCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MachineResponse:
    """Actualiza e incrementa el horómetro de una máquina.

    Permitido para Administradores, Supervisores y Mecánicos.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = UpdateMachineHorometerUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/status",
    response_model=MachineResponse,
)
async def change_status(
    command: ChangeMachineStatusCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> MachineResponse:
    """Modifica el estado operativo de una máquina (ej. DADA_DE_BAJA).

    Restringido a Administradores y Supervisores.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = ChangeMachineStatusUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.delete(
    "/{machine_id}",
    response_model=MachineResponse,
)
async def soft_delete_machine(
    machine_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> MachineResponse:
    """Realiza la baja lógica (Soft Delete) de una máquina.

    Restringido a Administradores y Supervisores.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = SoftDeleteMachineUseCase(service, uow)
    # Convertimos el string a UUID en el comando
    from uuid import UUID

    command = SoftDeleteMachineCommand(
        machine_id=UUID(machine_id),
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
async def query_machines(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina maquinaria de manera dinámica.

    Permitido para todos los roles autorizados.
    """
    repo = MachineRepository(uow)
    # El caso de uso Query de HexCore inyecta directamente el repositorio
    use_case = QueryMachinesUseCase(repo)
    return await use_case.execute(query)


@router.get(
    "/",
    response_model=list[MachineResponse],
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_machines(
    status: str | None = None,
    search: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[MachineResponse]:
    """Obtiene la lista de todas las máquinas, opcionalmente filtradas por estado o término de búsqueda."""
    from hexcore.application.dtos.query import QueryRequestDTO, FilterConditionDTO, FilterOperator
    
    filters = []
    if status:
        filters.append(FilterConditionDTO(field="status", operator=FilterOperator.EQ, value=status))
        
    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        search=search,
        search_fields=["code", "brand", "model"],
        filters=filters
    )
    repo = MachineRepository(uow)
    use_case = QueryMachinesUseCase(repo)
    result = await use_case.execute(query_dto)
    return [
        MachineResponse(
            id=m.id,
            code=m.code,
            motor_serial=m.motor_serial,
            brand=m.brand,
            model=m.model,
            manufacture_year=m.manufacture_year,
            current_horometer=m.current_horometer,
            status=m.status,
            created_at=m.created_at,
            updated_at=m.updated_at,
            is_active=m.is_active,
        )
        for m in result.items
    ]


@router.get(
    "/{machine_id}",
    response_model=MachineResponse,
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_machine(
    machine_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> MachineResponse:
    """Obtiene una máquina específica por su ID."""
    from uuid import UUID
    repo = MachineRepository(uow)
    m = await repo.get_by_id(UUID(machine_id))
    return MachineResponse(
        id=m.id,
        code=m.code,
        motor_serial=m.motor_serial,
        brand=m.brand,
        model=m.model,
        manufacture_year=m.manufacture_year,
        current_horometer=m.current_horometer,
        status=m.status,
        created_at=m.created_at,
        updated_at=m.updated_at,
        is_active=m.is_active,
    )


@router.put(
    "/{machine_id}/horometer",
    response_model=MachineResponse,
)
async def update_horometer_path(
    machine_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(
        require_roles(
            [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
        )
    ),
) -> MachineResponse:
    """Actualiza e incrementa el horómetro de una máquina utilizando parámetros en la URL."""
    from uuid import UUID
    
    new_horometer = payload.get("current_horometer") or payload.get("new_horometer")
    if new_horometer is None:
        raise ValueError("Se requiere 'current_horometer' o 'new_horometer' en el cuerpo de la petición.")
        
    command = UpdateMachineHorometerCommand(
        machine_id=UUID(machine_id),
        new_horometer=float(new_horometer),
        performed_by=current_user.better_auth_user_id
    )
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = UpdateMachineHorometerUseCase(service, uow)
    return await use_case.execute(command)


@router.put(
    "/{machine_id}/status",
    response_model=MachineResponse,
)
async def change_status_path(
    machine_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> MachineResponse:
    """Modifica el estado operativo de una máquina utilizando parámetros en la URL."""
    from uuid import UUID
    from src.features.machine.domain.entities import MachineStatus
    
    command = ChangeMachineStatusCommand(
        machine_id=UUID(machine_id),
        status=MachineStatus(payload["status"]),
        performed_by=current_user.better_auth_user_id
    )
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = ChangeMachineStatusUseCase(service, uow)
    return await use_case.execute(command)

