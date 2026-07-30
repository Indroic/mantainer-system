from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import AlertResponse
from src.features.alerts.domain.entities import Alert
from src.features.alerts.domain.services import AlertDomainService


def to_alert_response(alert: Alert) -> AlertResponse:
    return AlertResponse(
        id=alert.id,
        machine_id=alert.machine_id,
        spare_part_id=alert.spare_part_id,
        maintenance_plan_id=getattr(alert, "maintenance_plan_id", None),
        type=alert.type,
        message=alert.message,
        is_resolved=alert.is_resolved,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
        is_active=alert.is_active,
    )


class CheckAndGenerateAlertsUseCase(UseCase[None, list[AlertResponse]]):
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: None = None) -> list[AlertResponse]:
        async with self.uow:
            alerts = await self.service.check_and_generate_alerts()
            await self.uow.commit()

        return [to_alert_response(a) for a in alerts]
