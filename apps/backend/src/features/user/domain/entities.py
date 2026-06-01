from enum import Enum
from hexcore.domain.base import BaseEntity


class UserRole(str, Enum):
    ADMINISTRADOR = "Administrador"
    SUPERVISOR = "Supervisor"
    MECANICO = "Mecánico"


class UserMetadata(BaseEntity):
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float = 0.0

    def update_metadata(self, role: UserRole, hourly_rate: float) -> None:
        """Permite actualizar el rol o tarifa del usuario."""
        self.role = role
        self.hourly_rate = hourly_rate
