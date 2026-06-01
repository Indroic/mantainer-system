from sqlalchemy import select, func
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)
from src.features.reports.application.dtos import (
    CostReportFilterCommand,
    CostReportResponse,
)


class GetCostReportUseCase(UseCase[CostReportFilterCommand, CostReportResponse]):
    def __init__(self, uow: SqlAlchemyUnitOfWork) -> None:
        self.uow = uow

    async def execute(self, command: CostReportFilterCommand) -> CostReportResponse:
        async with self.uow:
            # 2. Sumatoria de Costo de Repuestos (Spare Parts Cost)
            # Hacemos join entre las órdenes liquidadas y sus repuestos asociados
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
                    MaintenanceOrderModel.machine_id == str(command.machine_id)
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

        return CostReportResponse(
            spare_parts_cost_total=float(spare_parts_cost_total),
            accumulated_cost_total=float(spare_parts_cost_total),
        )
