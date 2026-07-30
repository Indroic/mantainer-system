from uuid import UUID

from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.notifications.application.dtos import (
    MarkAllReadResponse,
    NotificationResponse,
)
from src.features.notifications.application.use_cases.query_notifications import (
    to_notification_response,
)
from src.features.notifications.domain.services import NotificationDomainService


class MarkNotificationReadUseCase(UseCase[UUID, NotificationResponse]):
    def __init__(self, service: NotificationDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(
        self, notification_id: UUID, recipient_user_id: str = ""
    ) -> NotificationResponse:
        async with self.uow:
            notification = await self.service.mark_as_read(
                notification_id, recipient_user_id
            )
            await self.uow.commit()
        return to_notification_response(notification)


class MarkAllNotificationsReadUseCase(UseCase[str, MarkAllReadResponse]):
    def __init__(self, service: NotificationDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, recipient_user_id: str) -> MarkAllReadResponse:
        async with self.uow:
            updated = await self.service.mark_all_read(recipient_user_id)
            await self.uow.commit()
        return MarkAllReadResponse(updated=updated)
