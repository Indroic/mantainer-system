from uuid import UUID
from fastapi import APIRouter, Depends, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import AlertResponse
from src.features.alerts.application.use_cases.check_alerts import (
    CheckAndGenerateAlertsUseCase,
)
from src.features.alerts.application.use_cases.query_alerts import (
    QueryAlertsUseCase,
)
from src.features.alerts.application.use_cases.resolve_alert import (
    ResolveAlertUseCase,
)
from src.features.alerts.domain.services import AlertDomainService
from src.features.alerts.infrastructure.repositories import AlertRepository
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.maintenance.infrastructure.repositories import (
    MaintenanceOrderRepository,
)
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.user.domain.entities import UserRole
from src.features.auth.dependencies import require_roles
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/alerts", tags=["Automatic Alerts"])


def get_alert_service(uow: SqlAlchemyUnitOfWork = Depends(get_uow)) -> AlertDomainService:
    return AlertDomainService(
        alert_repo=AlertRepository(uow),
        machine_repo=MachineRepository(uow),
        spare_part_repo=SparePartRepository(uow),
        maintenance_repo=MaintenanceOrderRepository(uow),
    )


@router.post(
    "/check",
    response_model=list[AlertResponse],
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))],
)
async def check_alerts(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
) -> list[AlertResponse]:
    """Gatilla un barrido en el sistema para generar o resolver alertas preventivas.

    Chequea stock bajo y cercanía a mantenimiento (<= 50h). Restringido a
    Administradores y Supervisores.
    """
    use_case = CheckAndGenerateAlertsUseCase(service, uow)
    return await use_case.execute()


@router.put(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))],
)
async def resolve_alert(
    alert_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
) -> AlertResponse:
    """Resuelve manualmente una alerta del sistema.

    Restringido a Administradores y Supervisores.
    """
    use_case = ResolveAlertUseCase(service, uow)
    return await use_case.execute(UUID(alert_id))


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
async def query_alerts(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina alertas de manera dinámica.

    Permitido para todos los roles autorizados.
    """
    repo = AlertRepository(uow)
    use_case = QueryAlertsUseCase(repo)
    return await use_case.execute(query)

