from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.user.domain.entities import UserRole


class CreateOrUpdateUserMetadataCommand(DTO):
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float
    performed_by: str | None = None


class UserMetadataResponse(DTO):
    id: UUID
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float
    created_at: datetime
    updated_at: datetime
    is_active: bool
