from fastapi import APIRouter, Depends, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    CAN_EXECUTE_ORDERS,
    CAN_MANAGE_MACHINES,
    require_roles,
)
from src.features.machine_type.application.dtos import (
    CreateMachineTypeCommand,
    MachineTypeResponse,
)
from src.features.machine_type.application.use_cases.create_machine_type import (
    CreateMachineTypeUseCase,
)
from src.features.machine_type.application.use_cases.query_machine_types import (
    QueryMachineTypesUseCase,
)
from src.features.machine_type.infrastructure.repositories import MachineTypeRepository
from src.features.user.application.dtos import UserMetadataResponse
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/machine-types", tags=["Machine Types"])


@router.post(
    "/",
    response_model=MachineTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_machine_type(
    command: CreateMachineTypeCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MachineTypeResponse:
    """Registra un nuevo tipo de maquinaria.

    Restringido a Administradores y Supervisores.
    """
    repo = MachineTypeRepository(uow)
    use_case = CreateMachineTypeUseCase(repo, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.get(
    "/",
    response_model=list[MachineTypeResponse],
    dependencies=[
        Depends(require_roles(CAN_EXECUTE_ORDERS))
    ],
)
async def get_machine_types(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[MachineTypeResponse]:
    """Obtiene el catálogo completo de tipos de maquinaria."""
    repo = MachineTypeRepository(uow)
    use_case = QueryMachineTypesUseCase(repo)
    query = QueryRequestDTO(limit=1000, offset=0)
    result = await use_case.execute(query)
    return [
        MachineTypeResponse(
            id=m.id,
            name=m.name,
            description=getattr(m, "description", None),
            created_at=m.created_at,
            updated_at=m.updated_at,
            is_active=m.is_active,
        )
        for m in result.items
    ]


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[
        Depends(require_roles(CAN_EXECUTE_ORDERS))
    ],
)
async def query_machine_types(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina tipos de maquinaria de manera dinámica."""
    repo = MachineTypeRepository(uow)
    use_case = QueryMachineTypesUseCase(repo)
    return await use_case.execute(query)
