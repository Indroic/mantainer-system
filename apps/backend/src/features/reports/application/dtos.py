from datetime import datetime
from enum import Enum
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CostReportFilterCommand(DTO):
    machine_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class CostReportItem(DTO):
    machine_code: str
    machine_brand: str
    machine_model: str
    spare_parts_cost: float


class CostReportResponse(DTO):
    total_spare_parts_cost: float
    machines_cost_breakdown: list[CostReportItem]
    spare_parts_cost_total: float | None = None
    accumulated_cost_total: float | None = None


class TechnicalHistoryItem(DTO):
    order_id: UUID
    date: datetime
    description: str
    mechanic_name: str
    spare_parts_cost: float
    total_cost: float
    horometer_at_time: float
    #: Clasificación de la falla y trabajo realizado (spec 4.1 / 5.1).
    failure_category: str | None = None
    failure_category_label: str | None = None
    work_performed: str | None = None


class MachineTechnicalHistoryResponse(DTO):
    machine_id: UUID
    machine_code: str
    maintenance_count: int
    history: list[TechnicalHistoryItem]


# ===========================================================================
# Analítica avanzada (spec 4.2)
# ===========================================================================
class ReportPeriod(str, Enum):
    """Granularidad temporal del reporte."""

    ANUAL = "ANUAL"
    MENSUAL = "MENSUAL"
    SEMANAL = "SEMANAL"
    #: Rango libre indicado mediante ``start_date`` / ``end_date``.
    PERSONALIZADO = "PERSONALIZADO"
    #: Sin recorte temporal: histórico completo.
    TOTAL = "TOTAL"


class ReportScope(str, Enum):
    """Alcance del reporte: toda la empresa o un activo concreto."""

    GENERAL = "GENERAL"
    INDIVIDUAL = "INDIVIDUAL"


class AnalyticsFilterCommand(DTO):
    period: ReportPeriod = ReportPeriod.ANUAL
    #: Fecha de anclaje del periodo (por defecto, hoy): define de qué año, mes o
    #: semana se está hablando.
    reference_date: datetime | None = None
    #: Solo para ``PERSONALIZADO``.
    start_date: datetime | None = None
    end_date: datetime | None = None
    scope: ReportScope = ReportScope.GENERAL
    #: Obligatorio cuando ``scope`` es ``INDIVIDUAL``.
    machine_id: UUID | None = None
    #: Segmentación por clasificación de falla (spec 4.1).
    failure_category: str | None = None
    #: Tamaño de los rankings ("top N").
    limit: int = 10


class ResolvedPeriod(DTO):
    period: ReportPeriod
    label: str
    start_date: datetime | None = None
    end_date: datetime | None = None


class AnalyticsTotals(DTO):
    total_spare_parts_cost: float = 0.0
    total_orders: int = 0
    liquidated_orders: int = 0
    open_orders: int = 0
    total_units_consumed: int = 0
    machines_with_failures: int = 0
    average_cost_per_order: float = 0.0


class MachineCostItem(DTO):
    """Maquinaria con más gastos acumulados."""

    machine_id: UUID | None = None
    machine_code: str
    machine_brand: str | None = None
    machine_model: str | None = None
    total_cost: float
    orders_count: int
    percentage: float


class SparePartUsageItem(DTO):
    """Partes / repuestos más utilizados."""

    spare_part_id: UUID | None = None
    spare_part_code: str
    spare_part_name: str
    total_quantity: int
    total_cost: float
    orders_count: int
    percentage: float


class MachineFailureItem(DTO):
    """Máquinas con mayor índice de averías."""

    machine_id: UUID | None = None
    machine_code: str
    machine_brand: str | None = None
    machine_model: str | None = None
    failures_count: int
    percentage: float
    total_cost: float = 0.0


class FailureCategoryItem(DTO):
    """Distribución de averías por clasificación de falla."""

    category: str
    label: str
    count: int
    percentage: float
    total_cost: float = 0.0


class TrendBucket(DTO):
    """Punto de la serie temporal de gasto."""

    label: str
    bucket_start: datetime
    total_cost: float
    orders_count: int


class AnalyticsReportResponse(DTO):
    resolved_period: ResolvedPeriod
    scope: ReportScope
    machine_id: UUID | None = None
    machine_code: str | None = None
    failure_category: str | None = None
    totals: AnalyticsTotals
    top_machines_by_cost: list[MachineCostItem] = []
    top_spare_parts: list[SparePartUsageItem] = []
    top_machines_by_failures: list[MachineFailureItem] = []
    failures_by_category: list[FailureCategoryItem] = []
    cost_trend: list[TrendBucket] = []


class FleetStatusSlice(DTO):
    """Porción del estado de la flota, en unidades y porcentaje (spec 4.3)."""

    status: str
    label: str
    count: int
    percentage: float


class FleetStatusResponse(DTO):
    total_machines: int
    slices: list[FleetStatusSlice]
