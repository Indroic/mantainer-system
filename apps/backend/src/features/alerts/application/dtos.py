from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.alerts.domain.entities import AlertType


class AlertResponse(DTO):
    id: UUID
    machine_id: UUID | None
    spare_part_id: UUID | None
    type: AlertType
    message: str
    is_resolved: bool
    created_at: datetime
    updated_at: datetime
    is_active: bool
