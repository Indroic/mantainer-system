from uuid import UUID

from sqlalchemy import desc, func, select, update
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.infrastructure.repositories.utils import to_entity_from_model_or_document
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.notifications.domain.entities import Notification, NotificationType
from src.features.notifications.domain.exceptions import NotificationNotFoundException
from src.features.notifications.infrastructure.models import NotificationModel


class NotificationRepository(
    SQLAlchemyCommonImplementationsRepo[Notification, NotificationModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[Notification]:
        return Notification

    @property
    def model_cls(self) -> type[NotificationModel]:
        return NotificationModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return NotificationNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None

    async def list_for_user(
        self,
        recipient_user_id: str,
        *,
        only_unread: bool = False,
        excluded_types: list[NotificationType] | None = None,
        limit: int = 100,
    ) -> list[Notification]:
        """Bandeja de notificaciones del usuario, recientes primero.

        ``excluded_types`` implementa el filtrado por rol en el servidor: por
        ejemplo el Mecánico nunca recibe ``BAJO_STOCK`` (spec 3.2), de modo que
        aunque existieran filas antiguas de ese tipo jamás se le muestran.
        """
        stmt = select(self.model_cls).where(
            self.model_cls.recipient_user_id == recipient_user_id,
            self.model_cls.is_active == True,  # noqa: E712
        )
        if only_unread:
            stmt = stmt.where(self.model_cls.is_read == False)  # noqa: E712
        if excluded_types:
            stmt = stmt.where(
                self.model_cls.type.notin_([t.value for t in excluded_types])
            )
        stmt = stmt.order_by(desc(self.model_cls.created_at)).limit(limit)

        result = await self.session.execute(stmt)
        return [
            await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
            for model in result.scalars().all()
        ]

    async def count_unread_for_user(
        self,
        recipient_user_id: str,
        excluded_types: list[NotificationType] | None = None,
    ) -> int:
        """Cuenta las notificaciones no leídas visibles para el usuario."""
        stmt = select(func.count()).select_from(self.model_cls).where(
            self.model_cls.recipient_user_id == recipient_user_id,
            self.model_cls.is_read == False,  # noqa: E712
            self.model_cls.is_active == True,  # noqa: E712
        )
        if excluded_types:
            stmt = stmt.where(
                self.model_cls.type.notin_([t.value for t in excluded_types])
            )
        result = await self.session.execute(stmt)
        return int(result.scalar_one_or_none() or 0)

    async def mark_all_read_for_user(self, recipient_user_id: str) -> int:
        """Marca como leídas todas las notificaciones del usuario. Devuelve el total afectado."""
        stmt = (
            update(self.model_cls)
            .where(
                self.model_cls.recipient_user_id == recipient_user_id,
                self.model_cls.is_read == False,  # noqa: E712
            )
            .values(is_read=True)
        )
        result = await self.session.execute(stmt)
        return int(result.rowcount or 0)

    async def exists_unread_of_type(
        self,
        recipient_user_id: str,
        notification_type: NotificationType,
        related_entity_id: UUID | None,
    ) -> bool:
        """Comprueba si ya hay una notificación no leída para el mismo evento.

        Evita inundar la bandeja cuando el barrido de alertas se ejecuta
        repetidamente sobre la misma condición (mismo repuesto o máquina).
        """
        stmt = select(self.model_cls.id).where(
            self.model_cls.recipient_user_id == recipient_user_id,
            self.model_cls.type == notification_type.value,
            self.model_cls.is_read == False,  # noqa: E712
            self.model_cls.is_active == True,  # noqa: E712
        )
        if related_entity_id is not None:
            stmt = stmt.where(self.model_cls.related_entity_id == related_entity_id)
        else:
            stmt = stmt.where(self.model_cls.related_entity_id.is_(None))

        result = await self.session.execute(stmt.limit(1))
        return result.scalar_one_or_none() is not None
