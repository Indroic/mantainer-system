from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.maintenance.domain.entities import (
    FailureCategory,
    MaintenanceStatus,
)
from src.features.machine.application.dtos import MachineResponse
from src.features.inventory.application.dtos import SparePartResponse
from src.features.solvency.application.dtos import SolvencyResponse


class CreateMaintenanceCommand(DTO):
    machine_id: UUID
    description: str
    assigned_mechanic_id: UUID
    failure_category: FailureCategory | None = None
    performed_by: str | None = None


class StartMaintenanceCommand(DTO):
    order_id: UUID
    performed_by: str | None = None


class AddSparePartToOrderCommand(DTO):
    order_id: UUID
    spare_part_id: UUID
    quantity: int
    performed_by: str | None = None


class ClassifyFailureCommand(DTO):
    """Permite reclasificar la falla de una OT ya registrada (spec 4.1)."""

    order_id: UUID
    failure_category: FailureCategory | None = None
    performed_by: str | None = None


class LiquidateMaintenanceCommand(DTO):
    order_id: UUID
    #: Descripción detallada del trabajo realizado (spec 5.1).
    work_performed: str | None = None
    performed_by: str | None = None


class MaintenanceSparePartResponse(DTO):
    id: UUID
    spare_part_id: UUID
    quantity_requested: int
    #: Alias de ``quantity_requested``; el frontend lo consume como ``quantity``.
    quantity: int | None = None
    #: ``None`` hasta que la OT se liquida y se congela el costo histórico.
    unit_cost_at_time: float | None = None
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
    next_service_horometer: float | None = None
    failure_category: FailureCategory | None = None
    failure_category_label: str | None = None
    work_performed: str | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    spare_parts: list[MaintenanceSparePartResponse] = []
    machine: MachineResponse | None = None
    #: Solvencias de repuestos emitidas para esta OT, descargables en PDF (spec 3.3).
    solvencies: list[SolvencyResponse] = []
    created_at: datetime
    updated_at: datetime
    is_active: bool
