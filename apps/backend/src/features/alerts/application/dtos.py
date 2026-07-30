from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.alerts.domain.entities import AlertType, MaintenancePlanBasis


class AlertResponse(DTO):
    id: UUID
    machine_id: UUID | None = None
    spare_part_id: UUID | None = None
    maintenance_plan_id: UUID | None = None
    type: AlertType
    message: str
    is_resolved: bool
    created_at: datetime
    updated_at: datetime
    is_active: bool


# ---------------------------------------------------------------------------
# Planes de mantenimiento preventivo por componente / uso (spec 5.2)
# ---------------------------------------------------------------------------
class CreateMaintenancePlanCommand(DTO):
    machine_id: UUID
    component_name: str
    interval_value: float
    basis: MaintenancePlanBasis = MaintenancePlanBasis.USO
    spare_part_id: UUID | None = None
    #: Si se omite, se toma el horómetro actual de la máquina.
    last_service_value: float | None = None
    warning_threshold: float = 50.0
    notes: str | None = None
    performed_by: str | None = None


class UpdateMaintenancePlanCommand(DTO):
    component_name: str | None = None
    interval_value: float | None = None
    basis: MaintenancePlanBasis | None = None
    spare_part_id: UUID | None = None
    last_service_value: float | None = None
    warning_threshold: float | None = None
    notes: str | None = None
    performed_by: str | None = None


class MaintenancePlanResponse(DTO):
    id: UUID
    machine_id: UUID
    machine_code: str | None = None
    spare_part_id: UUID | None = None
    spare_part_name: str | None = None
    component_name: str
    basis: MaintenancePlanBasis
    interval_value: float
    last_service_value: float
    warning_threshold: float
    notes: str | None = None
    #: Valores derivados, para que la UI no tenga que recalcularlos.
    target_value: float
    current_value: float
    remaining: float
    is_due: bool
    is_overdue: bool
    horometer_unit: str | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
