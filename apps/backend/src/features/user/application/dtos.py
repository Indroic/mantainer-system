from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.user.domain.entities import UserRole


class CreateOrUpdateUserMetadataCommand(DTO):
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float
    performed_by: str | None = None


class BootstrapAdminCommand(DTO):
    """Comando para registrar al administrador inicial.

    El ``better_auth_user_id`` se toma del JWT del usuario autenticado, no del cliente.
    """

    better_auth_user_id: str | None = None
    hourly_rate: float = 0.0


class UserMetadataResponse(DTO):
    id: UUID
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float
    created_at: datetime
    updated_at: datetime
    is_active: bool
