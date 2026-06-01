from enum import Enum
from uuid import UUID
from hexcore.domain.base import BaseEntity


class AlertType(str, Enum):
    MAINTENANCE_DUE = "MAINTENANCE_DUE"
    LOW_STOCK = "LOW_STOCK"


class Alert(BaseEntity):
    machine_id: UUID | None = None
    spare_part_id: UUID | None = None
    type: AlertType
    message: str
    is_resolved: bool = False

    def resolve(self) -> None:
        """Marca la alerta como resuelta."""
        self.is_resolved = True
