from uuid import UUID
from fastapi import APIRouter, Depends, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import (
    AlertResponse,
    CreateMaintenancePlanCommand,
    MaintenancePlanResponse,
    UpdateMaintenancePlanCommand,
)
from src.features.alerts.application.use_cases.check_alerts import (
    CheckAndGenerateAlertsUseCase,
)
from src.features.alerts.application.use_cases.manage_plans import (
    CreateMaintenancePlanUseCase,
    DeleteMaintenancePlanUseCase,
    RegisterPlanServiceUseCase,
    UpdateMaintenancePlanUseCase,
    to_plan_response,
)
from src.features.alerts.application.use_cases.query_alerts import (
    QueryAlertsUseCase,
)
from src.features.alerts.application.use_cases.resolve_alert import (
    ResolveAlertUseCase,
)
from src.features.alerts.domain.services import AlertDomainService
from src.features.alerts.infrastructure.repositories import (
    AlertRepository,
    MaintenancePlanRepository,
)
from src.features.auth.dependencies import (
    ALL_ROLES,
    CAN_MANAGE_MACHINES,
    CAN_RESOLVE_ALERTS,
    CAN_VIEW_REPORTS,
    CurrentUser,
    require_roles,
)
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.maintenance.infrastructure.repositories import (
    MaintenanceOrderRepository,
)
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.notifications.infrastructure.routes import build_notification_service
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/alerts", tags=["Automatic Alerts"])


def get_alert_service(uow: SqlAlchemyUnitOfWork = Depends(get_uow)) -> AlertDomainService:
    return AlertDomainService(
        alert_repo=AlertRepository(uow),
        machine_repo=MachineRepository(uow),
        spare_part_repo=SparePartRepository(uow),
        maintenance_repo=MaintenanceOrderRepository(uow),
        maintenance_plan_repo=MaintenancePlanRepository(uow),
        # Inyectamos notificaciones para que cada alerta nueva llegue además a la
        # bandeja de los roles pertinentes (spec 3.2 / 5.2).
        notification_service=build_notification_service(uow),
    )


@router.post(
    "/check",
    response_model=list[AlertResponse],
    dependencies=[Depends(require_roles(CAN_RESOLVE_ALERTS))],
)
async def check_alerts(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
) -> list[AlertResponse]:
    """Gatilla un barrido en el sistema para generar o resolver alertas preventivas.

    Chequea stock bajo, cercanía al mantenimiento global (<= 50 h) y los planes
    programados por componente/uso (spec 5.2). Cada alerta nueva se enruta a la
    bandeja de notificaciones de los roles correspondientes.
    """
    use_case = CheckAndGenerateAlertsUseCase(service, uow)
    return await use_case.execute()


@router.get("/", response_model=list[AlertResponse])
async def list_alerts(
    include_resolved: bool = False,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
    current_user: CurrentUser = Depends(require_roles(ALL_ROLES)),
) -> list[AlertResponse]:
    """Alertas visibles para el rol del usuario autenticado.

    El filtrado se aplica en el servidor: el Mecánico nunca recibe alertas de
    bajo stock (spec 3.2) y Almacén solo ve las de inventario.
    """
    alerts = await service.list_for_role(
        current_user.role, only_unresolved=not include_resolved
    )
    return [
        AlertResponse(
            id=a.id,
            machine_id=a.machine_id,
            spare_part_id=a.spare_part_id,
            maintenance_plan_id=getattr(a, "maintenance_plan_id", None),
            type=a.type,
            message=a.message,
            is_resolved=a.is_resolved,
            created_at=a.created_at,
            updated_at=a.updated_at,
            is_active=a.is_active,
        )
        for a in alerts
    ]


@router.put(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    dependencies=[Depends(require_roles(CAN_RESOLVE_ALERTS))],
)
async def resolve_alert(
    alert_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
) -> AlertResponse:
    """Resuelve manualmente una alerta del sistema.

    Permitido al Planificador, al Supervisor y a Almacén (que resuelve las de
    bajo stock al reponer inventario).
    """
    use_case = ResolveAlertUseCase(service, uow)
    return await use_case.execute(UUID(alert_id))


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[Depends(require_roles(ALL_ROLES))],
)
async def query_alerts(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina alertas de manera dinámica."""
    repo = AlertRepository(uow)
    use_case = QueryAlertsUseCase(repo)
    return await use_case.execute(query)


# ===========================================================================
# Planes de mantenimiento preventivo por componente / uso (spec 5.2)
# ===========================================================================
@router.get("/maintenance-plans", response_model=list[MaintenancePlanResponse])
async def list_maintenance_plans(
    machine_id: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
    current_user: CurrentUser = Depends(require_roles(ALL_ROLES)),
) -> list[MaintenancePlanResponse]:
    """Planes preventivos configurados, opcionalmente los de una máquina.

    Ejemplos: "cambio de aceite cada 10.000 km", "filtro cada 50.000 km".
    """
    plans = await service.list_plans(UUID(machine_id) if machine_id else None)
    return [await to_plan_response(plan, uow) for plan in plans]


@router.post(
    "/maintenance-plans",
    response_model=MaintenancePlanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_maintenance_plan(
    command: CreateMaintenancePlanCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
    current_user: CurrentUser = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MaintenancePlanResponse:
    """Configura una alerta programada por componente basada en uso o tiempo."""
    command.performed_by = current_user.better_auth_user_id
    use_case = CreateMaintenancePlanUseCase(service, uow)
    return await use_case.execute(command)


@router.put("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
async def update_maintenance_plan(
    plan_id: str,
    command: UpdateMaintenancePlanCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
    current_user: CurrentUser = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MaintenancePlanResponse:
    """Actualiza la configuración de un plan preventivo."""
    command.performed_by = current_user.better_auth_user_id
    use_case = UpdateMaintenancePlanUseCase(service, uow)
    return await use_case.execute(UUID(plan_id), command)


@router.put(
    "/maintenance-plans/{plan_id}/register-service",
    response_model=MaintenancePlanResponse,
)
async def register_plan_service(
    plan_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
    current_user: CurrentUser = Depends(require_roles(CAN_VIEW_REPORTS)),
) -> MaintenancePlanResponse:
    """Registra la ejecución del servicio del componente y reinicia el contador.

    Además resuelve la alerta preventiva que el plan hubiera generado.
    """
    use_case = RegisterPlanServiceUseCase(service, uow)
    return await use_case.execute(UUID(plan_id), current_user.better_auth_user_id)


@router.delete("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
async def delete_maintenance_plan(
    plan_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: AlertDomainService = Depends(get_alert_service),
    current_user: CurrentUser = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MaintenancePlanResponse:
    """Baja lógica de un plan de mantenimiento preventivo."""
    use_case = DeleteMaintenancePlanUseCase(service, uow)
    return await use_case.execute(UUID(plan_id), current_user.better_auth_user_id)
