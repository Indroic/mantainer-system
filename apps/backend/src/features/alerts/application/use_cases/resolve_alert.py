from uuid import UUID
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import AlertResponse
from src.features.alerts.domain.services import AlertDomainService


class ResolveAlertUseCase(UseCase[UUID, AlertResponse]):
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, alert_id: UUID) -> AlertResponse:
        async with self.uow:
            alert = await self.service.resolve_alert(alert_id)
            await self.uow.commit()

        return AlertResponse(
            id=alert.id,
            machine_id=alert.machine_id,
            spare_part_id=alert.spare_part_id,
            type=alert.type,
            message=alert.message,
            is_resolved=alert.is_resolved,
            created_at=alert.created_at,
            updated_at=alert.updated_at,
            is_active=alert.is_active,
        )
