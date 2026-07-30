from sqlalchemy import select, func
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)
from src.features.machine.infrastructure.models import MachineModel
from src.features.reports.application.dtos import (
    CostReportFilterCommand,
    CostReportResponse,
    CostReportItem,
)


class GetCostReportUseCase(UseCase[CostReportFilterCommand, CostReportResponse]):
    def __init__(self, uow: SqlAlchemyUnitOfWork) -> None:
        self.uow = uow

    async def execute(self, command: CostReportFilterCommand) -> CostReportResponse:
        async with self.uow:
            # 1. Sumatoria de Costo de Repuestos (Spare Parts Cost)
            parts_stmt = (
                select(
                    func.sum(
                        MaintenanceSparePartModel.quantity_requested
                        * MaintenanceSparePartModel.unit_cost_at_time
                    )
                )
                .join(
                    MaintenanceOrderModel,
                    MaintenanceOrderModel.id
                    == MaintenanceSparePartModel.maintenance_order_id,
                )
                .where(
                    MaintenanceOrderModel.status == "LIQUIDADO",
                    MaintenanceOrderModel.is_active == True,
                )
            )

            if command.machine_id:
                parts_stmt = parts_stmt.where(
                    MaintenanceOrderModel.machine_id == command.machine_id
                )
            if command.start_date:
                parts_stmt = parts_stmt.where(
                    MaintenanceOrderModel.created_at >= command.start_date
                )
            if command.end_date:
                parts_stmt = parts_stmt.where(
                    MaintenanceOrderModel.created_at <= command.end_date
                )

            parts_result = await self.uow.session.execute(parts_stmt)
            spare_parts_cost_total = parts_result.scalar_one_or_none() or 0.0

            # 2. Desglose de costos por máquina (machines_cost_breakdown)
            breakdown_stmt = (
                select(
                    MachineModel.code,
                    MachineModel.brand,
                    MachineModel.model,
                    func.sum(
                        MaintenanceSparePartModel.quantity_requested
                        * MaintenanceSparePartModel.unit_cost_at_time
                    ),
                )
                .join(
                    MaintenanceOrderModel,
                    MaintenanceOrderModel.machine_id == MachineModel.id,
                )
                .join(
                    MaintenanceSparePartModel,
                    MaintenanceOrderModel.id
                    == MaintenanceSparePartModel.maintenance_order_id,
                )
                .where(
                    MaintenanceOrderModel.status == "LIQUIDADO",
                    MaintenanceOrderModel.is_active == True,
                )
                .group_by(
                    MachineModel.code,
                    MachineModel.brand,
                    MachineModel.model,
                )
            )

            if command.machine_id:
                breakdown_stmt = breakdown_stmt.where(
                    MaintenanceOrderModel.machine_id == command.machine_id
                )
            if command.start_date:
                breakdown_stmt = breakdown_stmt.where(
                    MaintenanceOrderModel.created_at >= command.start_date
                )
            if command.end_date:
                breakdown_stmt = breakdown_stmt.where(
                    MaintenanceOrderModel.created_at <= command.end_date
                )

            breakdown_result = await self.uow.session.execute(breakdown_stmt)
            breakdown_rows = breakdown_result.all()

            machines_cost_breakdown = [
                CostReportItem(
                    machine_code=row[0],
                    machine_brand=row[1],
                    machine_model=row[2],
                    spare_parts_cost=float(row[3] or 0.0),
                )
                for row in breakdown_rows
            ]

        return CostReportResponse(
            total_spare_parts_cost=float(spare_parts_cost_total),
            machines_cost_breakdown=machines_cost_breakdown,
            spare_parts_cost_total=float(spare_parts_cost_total),
            accumulated_cost_total=float(spare_parts_cost_total),
        )
