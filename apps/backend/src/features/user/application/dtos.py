from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.user.domain.entities import UserRole


class CreateOrUpdateUserMetadataCommand(DTO):
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float
    performed_by: str | None = None


class CreateAdminCommand(DTO):
    """Comando para crear un Administrador validando una clave de creación estática."""

    better_auth_user_id: str
    hourly_rate: float = 0.0
    creation_key: str


class UserMetadataResponse(DTO):
    id: UUID
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float
    created_at: datetime
    updated_at: datetime
    is_active: bool
