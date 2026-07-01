from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CreateAuditLogCommand(DTO):
    entity_name: str
    entity_id: UUID
    action: str
    payload: dict
    performed_by: str


class AuditLogResponse(DTO):
    id: UUID
    entity_name: str
    entity_id: UUID
    action: str
    payload: str
    performed_by: str
    performed_by_name: str | None = None
    created_at: datetime
    is_active: bool
