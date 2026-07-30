from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CreateMachineTypeCommand(DTO):
    name: str
    description: str | None = None
    performed_by: str | None = None


class MachineTypeResponse(DTO):
    id: UUID
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
