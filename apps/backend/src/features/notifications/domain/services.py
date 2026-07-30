from uuid import UUID

from hexcore.domain.services import BaseDomainService
from src.features.notifications.domain.entities import (
    NOTIFICATION_AUDIENCE,
    Notification,
    NotificationSeverity,
    NotificationType,
)
from src.features.notifications.domain.exceptions import (
    NotificationForbiddenException,
)
from src.features.user.domain.entities import UserRole

#: Tipos de notificación que cada rol NUNCA debe ver, aunque existan filas
#: antiguas dirigidas a él. El Mecánico no recibe alertas de bajo stock (spec 3.2).
ROLE_EXCLUDED_TYPES: dict[UserRole, list[NotificationType]] = {
    UserRole.MECANICO: [NotificationType.BAJO_STOCK],
}


def excluded_types_for_role(role: UserRole | None) -> list[NotificationType]:
    """Tipos de notificación filtrados en el servidor para el rol dado."""
    if role is None:
        return []
    return ROLE_EXCLUDED_TYPES.get(role, [])


class NotificationDomainService(BaseDomainService):
    """Emite y gestiona notificaciones dirigidas.

    El fan-out por rol se resuelve contra la tabla ``user`` de Better Auth, que
    es la fuente de verdad de usuarios y roles del sistema.
    """

    def __init__(self, notification_repo, user_directory) -> None:
        self._repo = notification_repo
        #: Callable ``() -> list[tuple[id, name, role]]`` sobre Better Auth.
        self._user_directory = user_directory
        super().__init__()

    # ------------------------------------------------------------------
    # Emisión
    # ------------------------------------------------------------------
    async def notify_users(
        self,
        recipient_user_ids: list[str],
        *,
        type: NotificationType,
        title: str,
        message: str,
        severity: NotificationSeverity = NotificationSeverity.INFO,
        link: str | None = None,
        related_entity_id: UUID | None = None,
        deduplicate: bool = False,
    ) -> list[Notification]:
        """Crea una notificación por destinatario, omitiendo duplicados vacíos."""
        created: list[Notification] = []
        for user_id in dict.fromkeys(filter(None, recipient_user_ids)):
            if deduplicate and await self._repo.exists_unread_of_type(
                user_id, type, related_entity_id
            ):
                continue

            notification = Notification(
                recipient_user_id=user_id,
                type=type,
                title=title,
                message=message,
                severity=severity,
                link=link,
                related_entity_id=related_entity_id,
            )
            await self._repo.save(notification)
            created.append(notification)
        return created

    async def notify_roles(
        self,
        roles: list[UserRole],
        *,
        type: NotificationType,
        title: str,
        message: str,
        severity: NotificationSeverity = NotificationSeverity.INFO,
        link: str | None = None,
        related_entity_id: UUID | None = None,
        extra_user_ids: list[str] | None = None,
        deduplicate: bool = False,
    ) -> list[Notification]:
        """Emite la notificación a todos los usuarios que tengan alguno de los roles."""
        recipients = await self.resolve_users_by_roles(roles)
        recipients.extend(extra_user_ids or [])
        return await self.notify_users(
            recipients,
            type=type,
            title=title,
            message=message,
            severity=severity,
            link=link,
            related_entity_id=related_entity_id,
            deduplicate=deduplicate,
        )

    async def notify_event(
        self,
        type: NotificationType,
        *,
        title: str,
        message: str,
        severity: NotificationSeverity = NotificationSeverity.INFO,
        link: str | None = None,
        related_entity_id: UUID | None = None,
        extra_user_ids: list[str] | None = None,
        deduplicate: bool = False,
    ) -> list[Notification]:
        """Emite usando la audiencia por defecto declarada para el tipo de evento."""
        return await self.notify_roles(
            NOTIFICATION_AUDIENCE.get(type, []),
            type=type,
            title=title,
            message=message,
            severity=severity,
            link=link,
            related_entity_id=related_entity_id,
            extra_user_ids=extra_user_ids,
            deduplicate=deduplicate,
        )

    async def resolve_users_by_roles(self, roles: list[UserRole]) -> list[str]:
        """IDs de Better Auth de los usuarios cuyo rol está en ``roles``."""
        if not roles:
            return []

        wanted = set(roles)
        directory = await self._user_directory()
        matched: list[str] = []
        for user_id, _name, raw_role in directory:
            try:
                role = UserRole(raw_role) if raw_role else None
            except ValueError:
                role = None
            if role in wanted:
                matched.append(user_id)
        return matched

    # ------------------------------------------------------------------
    # Lectura / actualización
    # ------------------------------------------------------------------
    async def list_for_user(
        self,
        recipient_user_id: str,
        role: UserRole | None,
        *,
        only_unread: bool = False,
        limit: int = 100,
    ) -> list[Notification]:
        return await self._repo.list_for_user(
            recipient_user_id,
            only_unread=only_unread,
            excluded_types=excluded_types_for_role(role),
            limit=limit,
        )

    async def count_unread_for_user(
        self, recipient_user_id: str, role: UserRole | None
    ) -> int:
        return await self._repo.count_unread_for_user(
            recipient_user_id, excluded_types=excluded_types_for_role(role)
        )

    async def mark_as_read(
        self, notification_id: UUID, recipient_user_id: str
    ) -> Notification:
        """Marca una notificación como leída validando que sea del propio usuario."""
        notification = await self._repo.get_by_id(notification_id)
        if notification.recipient_user_id != recipient_user_id:
            raise NotificationForbiddenException(notification_id)
        notification.mark_as_read()
        await self._repo.save(notification)
        return notification

    async def mark_all_read(self, recipient_user_id: str) -> int:
        return await self._repo.mark_all_read_for_user(recipient_user_id)
