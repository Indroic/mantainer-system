"""Analítica avanzada de mantenimiento (spec 4.2).

Responde tres preguntas de negocio sobre un mismo periodo y alcance:
  · Maquinaria con más gastos acumulados.
  · Partes / repuestos más utilizados.
  · Máquinas con mayor índice de averías.

Los filtros temporales (Anual / Mensual / Semanal) y el alcance (General por toda
la empresa o Individual por activo) se resuelven en un único punto para que todos
los bloques del reporte hablen exactamente del mismo recorte de datos.
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.infrastructure.models import MachineModel
from src.features.maintenance.domain.entities import failure_category_label
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)
from src.features.inventory.infrastructure.models import SparePartModel
from src.features.reports.application.dtos import (
    AnalyticsFilterCommand,
    AnalyticsReportResponse,
    AnalyticsTotals,
    FailureCategoryItem,
    MachineCostItem,
    MachineFailureItem,
    ReportPeriod,
    ReportScope,
    ResolvedPeriod,
    SparePartUsageItem,
    TrendBucket,
)

MONTH_NAMES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def resolve_period(command: AnalyticsFilterCommand) -> ResolvedPeriod:
    """Traduce el filtro temporal a un rango concreto con etiqueta legible."""
    reference = command.reference_date or datetime.now(UTC).replace(tzinfo=None)
    reference = reference.replace(tzinfo=None)

    if command.period == ReportPeriod.TOTAL:
        return ResolvedPeriod(
            period=ReportPeriod.TOTAL, label="Histórico completo", start_date=None, end_date=None
        )

    if command.period == ReportPeriod.PERSONALIZADO:
        start = command.start_date
        end = command.end_date
        if start and end:
            label = f"{start.strftime('%d/%m/%Y')} – {end.strftime('%d/%m/%Y')}"
        elif start:
            label = f"Desde {start.strftime('%d/%m/%Y')}"
        elif end:
            label = f"Hasta {end.strftime('%d/%m/%Y')}"
        else:
            label = "Rango personalizado (sin límites)"
        return ResolvedPeriod(
            period=ReportPeriod.PERSONALIZADO, label=label, start_date=start, end_date=end
        )

    if command.period == ReportPeriod.ANUAL:
        start = datetime(reference.year, 1, 1)
        end = datetime(reference.year, 12, 31, 23, 59, 59)
        return ResolvedPeriod(
            period=ReportPeriod.ANUAL,
            label=f"Año {reference.year}",
            start_date=start,
            end_date=end,
        )

    if command.period == ReportPeriod.MENSUAL:
        last_day = calendar.monthrange(reference.year, reference.month)[1]
        start = datetime(reference.year, reference.month, 1)
        end = datetime(reference.year, reference.month, last_day, 23, 59, 59)
        return ResolvedPeriod(
            period=ReportPeriod.MENSUAL,
            label=f"{MONTH_NAMES_ES[reference.month - 1]} {reference.year}",
            start_date=start,
            end_date=end,
        )

    # SEMANAL: semana ISO (lunes a domingo) que contiene la fecha de referencia.
    monday = (reference - timedelta(days=reference.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return ResolvedPeriod(
        period=ReportPeriod.SEMANAL,
        label=(
            f"Semana {monday.isocalendar().week} "
            f"({monday.strftime('%d/%m')} – {sunday.strftime('%d/%m/%Y')})"
        ),
        start_date=monday,
        end_date=sunday,
    )


def _percentage(part: float, total: float) -> float:
    return round((part / total) * 100, 2) if total else 0.0


class GetAnalyticsReportUseCase(UseCase[AnalyticsFilterCommand, AnalyticsReportResponse]):
    def __init__(self, uow: SqlAlchemyUnitOfWork) -> None:
        self.uow = uow

    async def execute(self, command: AnalyticsFilterCommand) -> AnalyticsReportResponse:
        period = resolve_period(command)
        limit = max(1, min(command.limit or 10, 50))

        machine_id: UUID | None = (
            command.machine_id if command.scope == ReportScope.INDIVIDUAL else None
        )
        if command.scope == ReportScope.INDIVIDUAL and machine_id is None:
            raise ValueError(
                "Para un reporte Individual debe indicarse la máquina ('machine_id')."
            )

        async with self.uow:
            # Todas las consultas parten de las OT que caen en el recorte, para
            # que los bloques del reporte sean comparables entre sí.
            orders = await self._load_orders(period, machine_id, command.failure_category)
            order_ids = [o.id for o in orders]

            part_rows = await self._load_spare_part_rows(order_ids)

            machine_code = None
            if machine_id is not None:
                machine_code = await self._machine_code(machine_id)

        # ------------------------------------------------------------------
        # Agregaciones en Python: el recorte ya viene filtrado por SQL y así el
        # cálculo es idéntico en PostgreSQL y en SQLite (sin date_trunc).
        # ------------------------------------------------------------------
        machine_lookup = {
            o.machine_id: (o.machine_code, o.machine_brand, o.machine_model) for o in orders
        }

        cost_by_order: dict[UUID, float] = defaultdict(float)
        units_by_order: dict[UUID, int] = defaultdict(int)
        part_totals: dict[UUID, dict] = {}

        for row in part_rows:
            line_cost = float(row.quantity or 0) * float(row.unit_cost or 0.0)
            cost_by_order[row.order_id] += line_cost
            units_by_order[row.order_id] += int(row.quantity or 0)

            entry = part_totals.setdefault(
                row.spare_part_id,
                {
                    "code": row.spare_part_code or "—",
                    "name": row.spare_part_name or "Repuesto",
                    "quantity": 0,
                    "cost": 0.0,
                    "orders": set(),
                },
            )
            entry["quantity"] += int(row.quantity or 0)
            entry["cost"] += line_cost
            entry["orders"].add(row.order_id)

        total_cost = sum(cost_by_order.values())
        total_units = sum(units_by_order.values())
        liquidated = [o for o in orders if o.status == "LIQUIDADO"]

        totals = AnalyticsTotals(
            total_spare_parts_cost=round(total_cost, 2),
            total_orders=len(orders),
            liquidated_orders=len(liquidated),
            open_orders=len(orders) - len(liquidated),
            total_units_consumed=total_units,
            machines_with_failures=len({o.machine_id for o in orders}),
            average_cost_per_order=round(total_cost / len(orders), 2) if orders else 0.0,
        )

        return AnalyticsReportResponse(
            resolved_period=period,
            scope=command.scope,
            machine_id=machine_id,
            machine_code=machine_code,
            failure_category=command.failure_category,
            totals=totals,
            top_machines_by_cost=self._top_machines_by_cost(
                orders, cost_by_order, machine_lookup, total_cost, limit
            ),
            top_spare_parts=self._top_spare_parts(part_totals, total_cost, limit),
            top_machines_by_failures=self._top_machines_by_failures(
                orders, cost_by_order, machine_lookup, limit
            ),
            failures_by_category=self._failures_by_category(orders, cost_by_order),
            cost_trend=self._cost_trend(orders, cost_by_order, period),
        )

    # ------------------------------------------------------------------
    # Carga de datos
    # ------------------------------------------------------------------
    async def _load_orders(
        self,
        period: ResolvedPeriod,
        machine_id: UUID | None,
        failure_category: str | None,
    ):
        """OT del recorte, ya unidas a su máquina para tener código/marca/modelo."""
        stmt = (
            select(
                MaintenanceOrderModel.id.label("id"),
                MaintenanceOrderModel.machine_id.label("machine_id"),
                MaintenanceOrderModel.status.label("status"),
                MaintenanceOrderModel.failure_category.label("failure_category"),
                MaintenanceOrderModel.created_at.label("created_at"),
                MachineModel.code.label("machine_code"),
                MachineModel.brand.label("machine_brand"),
                MachineModel.model.label("machine_model"),
            )
            .join(MachineModel, MachineModel.id == MaintenanceOrderModel.machine_id)
            .where(MaintenanceOrderModel.is_active == True)  # noqa: E712
        )

        if machine_id is not None:
            stmt = stmt.where(MaintenanceOrderModel.machine_id == machine_id)
        if failure_category:
            stmt = stmt.where(
                MaintenanceOrderModel.failure_category == failure_category
            )
        if period.start_date:
            stmt = stmt.where(MaintenanceOrderModel.created_at >= period.start_date)
        if period.end_date:
            stmt = stmt.where(MaintenanceOrderModel.created_at <= period.end_date)

        result = await self.uow.session.execute(stmt)
        return result.all()

    async def _load_spare_part_rows(self, order_ids: list[UUID]):
        """Líneas de repuesto de esas OT, con código/nombre del catálogo.

        Se usa ``unit_cost_at_time`` cuando existe (costo histórico congelado al
        liquidar) y, si aún es nulo, el costo vigente del catálogo como estimación.
        """
        if not order_ids:
            return []

        stmt = (
            select(
                MaintenanceSparePartModel.maintenance_order_id.label("order_id"),
                MaintenanceSparePartModel.spare_part_id.label("spare_part_id"),
                MaintenanceSparePartModel.quantity_requested.label("quantity"),
                func.coalesce(
                    MaintenanceSparePartModel.unit_cost_at_time,
                    SparePartModel.unit_cost,
                    0.0,
                ).label("unit_cost"),
                SparePartModel.code.label("spare_part_code"),
                SparePartModel.name.label("spare_part_name"),
            )
            .outerjoin(
                SparePartModel,
                SparePartModel.id == MaintenanceSparePartModel.spare_part_id,
            )
            .where(
                MaintenanceSparePartModel.maintenance_order_id.in_(order_ids),
                MaintenanceSparePartModel.is_active == True,  # noqa: E712
            )
        )
        result = await self.uow.session.execute(stmt)
        return result.all()

    async def _machine_code(self, machine_id: UUID) -> str | None:
        stmt = select(MachineModel.code).where(MachineModel.id == machine_id)
        result = await self.uow.session.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Rankings
    # ------------------------------------------------------------------
    def _top_machines_by_cost(
        self, orders, cost_by_order, machine_lookup, total_cost, limit
    ) -> list[MachineCostItem]:
        """Maquinaria con más gastos acumulados."""
        agg: dict[UUID, dict] = defaultdict(lambda: {"cost": 0.0, "orders": 0})
        for order in orders:
            bucket = agg[order.machine_id]
            bucket["cost"] += cost_by_order.get(order.id, 0.0)
            bucket["orders"] += 1

        items = []
        for machine_id, data in agg.items():
            code, brand, model = machine_lookup.get(machine_id, ("—", None, None))
            items.append(
                MachineCostItem(
                    machine_id=machine_id,
                    machine_code=code or "—",
                    machine_brand=brand,
                    machine_model=model,
                    total_cost=round(data["cost"], 2),
                    orders_count=data["orders"],
                    percentage=_percentage(data["cost"], total_cost),
                )
            )
        items.sort(key=lambda i: i.total_cost, reverse=True)
        return items[:limit]

    def _top_spare_parts(self, part_totals, total_cost, limit) -> list[SparePartUsageItem]:
        """Partes / repuestos más utilizados (por unidades consumidas)."""
        items = [
            SparePartUsageItem(
                spare_part_id=part_id,
                spare_part_code=data["code"],
                spare_part_name=data["name"],
                total_quantity=data["quantity"],
                total_cost=round(data["cost"], 2),
                orders_count=len(data["orders"]),
                percentage=_percentage(data["cost"], total_cost),
            )
            for part_id, data in part_totals.items()
        ]
        items.sort(key=lambda i: (i.total_quantity, i.total_cost), reverse=True)
        return items[:limit]

    def _top_machines_by_failures(
        self, orders, cost_by_order, machine_lookup, limit
    ) -> list[MachineFailureItem]:
        """Máquinas con mayor índice de averías (número de OT registradas)."""
        agg: dict[UUID, dict] = defaultdict(lambda: {"count": 0, "cost": 0.0})
        for order in orders:
            bucket = agg[order.machine_id]
            bucket["count"] += 1
            bucket["cost"] += cost_by_order.get(order.id, 0.0)

        total_failures = sum(d["count"] for d in agg.values())
        items = []
        for machine_id, data in agg.items():
            code, brand, model = machine_lookup.get(machine_id, ("—", None, None))
            items.append(
                MachineFailureItem(
                    machine_id=machine_id,
                    machine_code=code or "—",
                    machine_brand=brand,
                    machine_model=model,
                    failures_count=data["count"],
                    percentage=_percentage(data["count"], total_failures),
                    total_cost=round(data["cost"], 2),
                )
            )
        items.sort(key=lambda i: i.failures_count, reverse=True)
        return items[:limit]

    def _failures_by_category(self, orders, cost_by_order) -> list[FailureCategoryItem]:
        """Distribución de averías por clasificación de falla (spec 4.1)."""
        agg: dict[str, dict] = defaultdict(lambda: {"count": 0, "cost": 0.0})
        for order in orders:
            key = order.failure_category or "SIN_CLASIFICAR"
            agg[key]["count"] += 1
            agg[key]["cost"] += cost_by_order.get(order.id, 0.0)

        total = sum(d["count"] for d in agg.values())
        items = [
            FailureCategoryItem(
                category=key,
                label=("Sin clasificar" if key == "SIN_CLASIFICAR" else failure_category_label(key)),
                count=data["count"],
                percentage=_percentage(data["count"], total),
                total_cost=round(data["cost"], 2),
            )
            for key, data in agg.items()
        ]
        items.sort(key=lambda i: i.count, reverse=True)
        return items

    # ------------------------------------------------------------------
    # Serie temporal
    # ------------------------------------------------------------------
    def _cost_trend(self, orders, cost_by_order, period: ResolvedPeriod) -> list[TrendBucket]:
        """Serie de gasto con granularidad acorde al periodo elegido.

        Anual → meses; Mensual → días; Semanal → días; Total/Personalizado → meses.
        """
        if not orders:
            return []

        granularity = "day" if period.period in (
            ReportPeriod.MENSUAL,
            ReportPeriod.SEMANAL,
        ) else "month"

        agg: dict[datetime, dict] = defaultdict(lambda: {"cost": 0.0, "orders": 0})
        for order in orders:
            created = order.created_at
            if created is None:
                continue
            created = created.replace(tzinfo=None)
            if granularity == "day":
                key = created.replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                key = datetime(created.year, created.month, 1)

            agg[key]["cost"] += cost_by_order.get(order.id, 0.0)
            agg[key]["orders"] += 1

        buckets = []
        for key in sorted(agg):
            data = agg[key]
            label = (
                key.strftime("%d/%m")
                if granularity == "day"
                else f"{MONTH_NAMES_ES[key.month - 1][:3]} {key.year}"
            )
            buckets.append(
                TrendBucket(
                    label=label,
                    bucket_start=key,
                    total_cost=round(data["cost"], 2),
                    orders_count=data["orders"],
                )
            )
        return buckets
