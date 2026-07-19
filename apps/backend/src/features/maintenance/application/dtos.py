from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.maintenance.domain.entities import MaintenanceStatus
from src.features.machine.application.dtos import MachineResponse
from src.features.inventory.application.dtos import SparePartResponse


class CreateMaintenanceCommand(DTO):
    machine_id: UUID
    description: str
    assigned_mechanic_id: UUID
    performed_by: str | None = None


class StartMaintenanceCommand(DTO):
    order_id: UUID
    performed_by: str | None = None


class AddSparePartToOrderCommand(DTO):
    order_id: UUID
    spare_part_id: UUID
    quantity: int
    performed_by: str | None = None


class LiquidateMaintenanceCommand(DTO):
    order_id: UUID
    performed_by: str | None = None


class MaintenanceSparePartResponse(DTO):
    id: UUID
    spare_part_id: UUID
    quantity_requested: int
    quantity: int | None = None
    unit_cost_at_time: float | None
    spare_part: SparePartResponse | None = None


class MechanicResponse(DTO):
    id: UUID
    better_auth_user_id: str
    name: str


class MaintenanceResponse(DTO):
    id: UUID
    machine_id: UUID
    description: str
    status: MaintenanceStatus
    assigned_mechanic_id: UUID
    assigned_mechanic_name: str | None = None
    next_service_horometer: float | None
    spare_parts: list[MaintenanceSparePartResponse]
    machine: MachineResponse | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool

