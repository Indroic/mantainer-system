from uuid import UUID
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import AlertResponse
from src.features.alerts.application.use_cases.check_alerts import to_alert_response
from src.features.alerts.domain.services import AlertDomainService


class ResolveAlertUseCase(UseCase[UUID, AlertResponse]):
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, alert_id: UUID) -> AlertResponse:
        async with self.uow:
            alert = await self.service.resolve_alert(alert_id)
            await self.uow.commit()

        return to_alert_response(alert)
