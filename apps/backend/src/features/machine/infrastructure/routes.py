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
