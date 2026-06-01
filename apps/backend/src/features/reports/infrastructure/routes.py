from uuid import UUID
from fastapi import APIRouter, Depends
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
from src.features.reports.application.dtos import (
    CostReportFilterCommand,
    CostReportResponse,
    MachineTechnicalHistoryResponse,
)
from src.features.reports.application.use_cases.get_cost_report import (
    GetCostReportUseCase,
)
from src.features.reports.application.use_cases.get_technical_history import (
    GetMachineTechnicalHistoryUseCase,
)
from src.features.user.domain.entities import UserRole
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/reports", tags=["Analytical Reports & History"])


@router.post(
    "/costs",
    response_model=CostReportResponse,
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))],
)
async def get_cost_report(
    command: CostReportFilterCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> CostReportResponse:
    """Obtiene un reporte analítico agregado de costos de mantenimiento e inventario.

    Permite filtrar por máquina y por rango de fechas. Restringido a
    Administradores y Supervisores.
    """
    use_case = GetCostReportUseCase(uow)
    return await use_case.execute(command)


@router.get(
    "/technical-history/{machine_id}",
    response_model=MachineTechnicalHistoryResponse,
    dependencies=[
        Depends(
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_technical_history(
    machine_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> MachineTechnicalHistoryResponse:
    """Recupera la hoja de vida inmutable consolidada de una máquina.

    Muestra el historial cronológico de mantenimientos liquidados, costos y
    técnicos. Permitido para Administradores, Supervisores y Mecánicos.
    """
    use_case = GetMachineTechnicalHistoryUseCase(uow)
    return await use_case.execute(UUID(machine_id))

