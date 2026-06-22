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
    "/costs",
    response_model=CostReportResponse,
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))],
)
async def get_cost_report_get(
    machine_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> CostReportResponse:
    """Obtiene un reporte analítico de costos mediante GET."""
    from src.features.reports.application.dtos import CostReportFilterCommand
    from datetime import datetime
    
    start_dt = None
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                pass
            
    end_dt = None
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            except ValueError:
                pass

    from uuid import UUID
    machine_uuid = UUID(machine_id) if machine_id else None

    command = CostReportFilterCommand(
        machine_id=machine_uuid,
        start_date=start_dt,
        end_date=end_dt
    )
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

