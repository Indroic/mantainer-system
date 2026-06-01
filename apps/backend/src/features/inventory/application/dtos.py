from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CreateSparePartCommand(DTO):
    code: str
    name: str
    stock_minimum: int
    unit_cost: float
    stock_current: int = 0
    performed_by: str | None = None


class UpdateSparePartStockCommand(DTO):
    spare_part_id: UUID
    new_stock: int
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
    created_at: datetime
    updated_at: datetime
    is_active: bool
