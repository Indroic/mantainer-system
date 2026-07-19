from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CreateSparePartCommand(DTO):
    code: str
    name: str
    stock_minimum: int
    unit_cost: float
    stock_current: int = 0
    # Campos extendidos
    part_number: str | None = None
    unit_of_measure: str | None = None
    internal_code: str | None = None
    unit_cost_usd: float | None = None
    performed_by: str | None = None


class UpdateSparePartStockCommand(DTO):
    spare_part_id: UUID
    new_stock: int
    performed_by: str | None = None


class UpdateSparePartPriceCommand(DTO):
    """Actualiza dinámicamente el precio unitario en USD de un repuesto."""
    spare_part_id: UUID
    new_unit_cost_usd: float
    performed_by: str | None = None


class SoftDeleteSparePartCommand(DTO):
    spare_part_id: UUID
    performed_by: str | None = None


class SparePartResponse(DTO):
    id: UUID
    code: str
    name: str
    stock_current: int
    stock_minimum: int
    unit_cost: float
    # Campos extendidos
    part_number: str | None = None
    unit_of_measure: str | None = None
    internal_code: str | None = None
    unit_cost_usd: float | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
