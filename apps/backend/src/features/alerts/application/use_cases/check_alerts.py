from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import AlertResponse
from src.features.alerts.domain.services import AlertDomainService


class CheckAndGenerateAlertsUseCase(UseCase[None, list[AlertResponse]]):
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: None = None) -> list[AlertResponse]:
        async with self.uow:
            alerts = await self.service.check_and_generate_alerts()
            await self.uow.commit()

        return [
            AlertResponse(
                id=a.id,
                machine_id=a.machine_id,
                spare_part_id=a.spare_part_id,
                type=a.type,
                message=a.message,
                is_resolved=a.is_resolved,
                created_at=a.created_at,
                updated_at=a.updated_at,
                is_active=a.is_active,
            )
            for a in alerts
        ]
