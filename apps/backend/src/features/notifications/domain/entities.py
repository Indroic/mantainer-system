from enum import Enum
from uuid import UUID

from hexcore.domain.base import BaseEntity
from src.features.user.domain.entities import UserRole


class NotificationType(str, Enum):
    """Eventos del sistema que generan una notificación dirigida."""

    #: El Supervisor o el Mecánico creó una OT: el Planificador debe revisarla y
    #: asignar los repuestos necesarios (spec 2.2).
    OT_CREADA = "OT_CREADA"
    #: El Mecánico liquidó/cerró una OT: el Planificador es notificado al instante (spec 3.1).
    OT_LIQUIDADA = "OT_LIQUIDADA"
    #: El Planificador asignó repuestos y se emitió la Solvencia (spec 3.3).
    SOLVENCIA_EMITIDA = "SOLVENCIA_EMITIDA"
    #: Stock por debajo del mínimo. NUNCA se dirige al Mecánico (spec 3.2).
    BAJO_STOCK = "BAJO_STOCK"
    #: Mantenimiento preventivo próximo por horómetro global de la máquina.
    MANTENIMIENTO_PROXIMO = "MANTENIMIENTO_PROXIMO"
    #: Meta de uso alcanzada para un componente/repuesto programado (spec 5.2).
    SERVICIO_COMPONENTE = "SERVICIO_COMPONENTE"


class NotificationSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


#: Audiencia por defecto de cada evento. Es la política central de enrutamiento:
#: el Mecánico está deliberadamente ausente de ``BAJO_STOCK`` (spec 3.2).
NOTIFICATION_AUDIENCE: dict[NotificationType, list[UserRole]] = {
    NotificationType.OT_CREADA: [UserRole.PLANIFICADOR],
    NotificationType.OT_LIQUIDADA: [UserRole.PLANIFICADOR],
    NotificationType.SOLVENCIA_EMITIDA: [
        UserRole.SUPERVISOR,
        UserRole.MECANICO,
        UserRole.ALMACEN,
    ],
    NotificationType.BAJO_STOCK: [UserRole.PLANIFICADOR, UserRole.ALMACEN],
    NotificationType.MANTENIMIENTO_PROXIMO: [
        UserRole.PLANIFICADOR,
        UserRole.SUPERVISOR,
        UserRole.MECANICO,
    ],
    NotificationType.SERVICIO_COMPONENTE: [
        UserRole.PLANIFICADOR,
        UserRole.SUPERVISOR,
    ],
}


class Notification(BaseEntity):
    """Notificación dirigida a un usuario concreto de Better Auth.

    El fan-out por rol se resuelve al emitir (una fila por destinatario), no al
    leer: así la bandeja de cada usuario es estable aunque su rol cambie después.
    """

    recipient_user_id: str
    type: NotificationType
    title: str
    message: str
    severity: NotificationSeverity = NotificationSeverity.INFO
    is_read: bool = False
    #: Ruta del frontend a la que navegar al pulsar la notificación.
    link: str | None = None
    #: Entidad de negocio relacionada (OT, repuesto, solvencia...).
    related_entity_id: UUID | None = None

    def mark_as_read(self) -> None:
        """Marca la notificación como leída."""
        self.is_read = True
