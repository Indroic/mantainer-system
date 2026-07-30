from sqlalchemy import Boolean, Column, Index, String, Text, Uuid
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class NotificationModel(BaseModel):
    __tablename__ = "notifications"

    #: ID de Better Auth del destinatario (la tabla `user` vive en la misma BD,
    #: pero no declaramos FK para no acoplar Hexcore al esquema de Better Auth).
    recipient_user_id = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="INFO")
    is_read = Column(Boolean, nullable=False, default=False)
    link = Column(String(255), nullable=True)
    related_entity_id = Column(Uuid, nullable=True)

    __table_args__ = (
        # La bandeja se consulta siempre como "no leídas de este usuario, recientes primero".
        Index("notifications_recipient_unread_idx", "recipient_user_id", "is_read"),
    )
