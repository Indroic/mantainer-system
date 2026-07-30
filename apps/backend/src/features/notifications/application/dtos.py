from datetime import datetime
from uuid import UUID

from hexcore.application.dtos.base import DTO
from src.features.notifications.domain.entities import (
    NotificationSeverity,
    NotificationType,
)


class NotificationResponse(DTO):
    id: UUID
    type: NotificationType
    title: str
    message: str
    severity: NotificationSeverity
    is_read: bool
    link: str | None = None
    related_entity_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool


class NotificationInboxResponse(DTO):
    """Bandeja completa: la campana necesita el contador y la lista en una sola llamada."""

    unread_count: int
    items: list[NotificationResponse]


class MarkAllReadResponse(DTO):
    updated: int
