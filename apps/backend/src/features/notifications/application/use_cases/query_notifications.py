from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.notifications.application.dtos import (
    NotificationInboxResponse,
    NotificationResponse,
)
from src.features.notifications.domain.entities import Notification
from src.features.notifications.domain.services import NotificationDomainService
from src.features.user.domain.entities import UserRole


def to_notification_response(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        type=notification.type,
        title=notification.title,
        message=notification.message,
        severity=notification.severity,
        is_read=notification.is_read,
        link=notification.link,
        related_entity_id=notification.related_entity_id,
        created_at=notification.created_at,
        updated_at=notification.updated_at,
        is_active=notification.is_active,
    )


class QueryNotificationInboxUseCase(UseCase[str, NotificationInboxResponse]):
    """Devuelve la bandeja del usuario junto con el contador de no leídas."""

    def __init__(self, service: NotificationDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(
        self,
        recipient_user_id: str,
        role: UserRole | None = None,
        only_unread: bool = False,
        limit: int = 100,
    ) -> NotificationInboxResponse:
        async with self.uow:
            notifications = await self.service.list_for_user(
                recipient_user_id, role, only_unread=only_unread, limit=limit
            )
            unread_count = await self.service.count_unread_for_user(
                recipient_user_id, role
            )

        return NotificationInboxResponse(
            unread_count=unread_count,
            items=[to_notification_response(n) for n in notifications],
        )
