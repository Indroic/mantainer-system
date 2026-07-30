from datetime import datetime
from uuid import UUID

from hexcore.application.dtos.base import DTO
from src.features.solvency.domain.entities import SolvencyStatus, SolvencyType


class SolvencyItemResponse(DTO):
    id: UUID
    spare_part_id: UUID
    spare_part_code: str
    spare_part_name: str
    quantity: int
    unit_cost: float
    subtotal: float


class SolvencyResponse(DTO):
    id: UUID
    code: str
    solvency_type: SolvencyType = SolvencyType.ASIGNACION
    maintenance_order_id: UUID
    machine_id: UUID
    machine_code: str | None = None
    issued_by: str
    issued_by_name: str | None = None
    status: SolvencyStatus
    dispatched_by: str | None = None
    dispatched_by_name: str | None = None
    notes: str | None = None
    items: list[SolvencyItemResponse]
    total_cost: float
    total_units: int
    #: Descripción de la OT amparada, para que la bandeja de Almacén sea legible
    #: sin tener que abrir la orden.
    order_description: str | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool


class DispatchSolvencyCommand(DTO):
    solvency_id: UUID
    performed_by: str | None = None
