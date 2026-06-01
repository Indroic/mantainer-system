from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CostReportFilterCommand(DTO):
    machine_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class CostReportResponse(DTO):
    spare_parts_cost_total: float
    accumulated_cost_total: float


class TechnicalHistoryItem(DTO):
    order_id: UUID
    date: datetime
    description: str
    mechanic_name: str
    spare_parts_cost: float
    total_cost: float
    horometer_at_time: float


class MachineTechnicalHistoryResponse(DTO):
    machine_id: UUID
    machine_code: str
    maintenance_count: int
    history: list[TechnicalHistoryItem]
