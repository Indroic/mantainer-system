from uuid import UUID
from sqlalchemy import select
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.infrastructure.models import MachineModel
from src.features.maintenance.domain.entities import failure_category_label
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)
from src.shared.infrastructure.database.user_lookup import resolve_user_names
from src.features.reports.application.dtos import (
    MachineTechnicalHistoryResponse,
    TechnicalHistoryItem,
)
from src.features.user.infrastructure.models import UserMetadataModel


class GetMachineTechnicalHistoryUseCase(
    UseCase[UUID, MachineTechnicalHistoryResponse]
):
    def __init__(self, uow: SqlAlchemyUnitOfWork) -> None:
        self.uow = uow

    async def execute(self, machine_id: UUID) -> MachineTechnicalHistoryResponse:
        async with self.uow:
            # 1. Recuperamos la máquina
            machine_stmt = select(MachineModel).where(
                MachineModel.id == machine_id,
                MachineModel.is_active == True,
            )
            machine_result = await self.uow.session.execute(machine_stmt)
            machine = machine_result.scalar_one_or_none()
            if not machine:
                raise ValueError(
                    f"No se encontró la máquina con ID '{machine_id}'."
                )

            # 2. Recuperamos todas las OTs liquidadas para esa máquina en orden cronológico
            orders_stmt = (
                select(MaintenanceOrderModel)
                .where(
                    MaintenanceOrderModel.machine_id == machine_id,
                    MaintenanceOrderModel.status == "LIQUIDADO",
                    MaintenanceOrderModel.is_active == True,
                )
                .order_by(MaintenanceOrderModel.created_at.asc())
            )
            orders_result = await self.uow.session.execute(orders_stmt)
            orders = orders_result.scalars().all()

            history_items = []
            for order in orders:
                # Obtenemos los datos del técnico asignado de UserMetadata y
                # resolvemos su nombre real en Better Auth (fuente de verdad).
                tech_stmt = select(UserMetadataModel.better_auth_user_id).where(
                    UserMetadataModel.id == order.assigned_mechanic_id
                )
                tech_result = await self.uow.session.execute(tech_stmt)
                tech_id = tech_result.scalar_one_or_none() or "Mecánico"

                mechanic_name = tech_id
                if tech_id and tech_id != "Mecánico":
                    try:
                        names = await resolve_user_names(self.uow.session, [tech_id])
                        mechanic_name = names.get(tech_id) or tech_id
                    except Exception:
                        mechanic_name = tech_id

                # Calculamos el costo de repuestos asociado
                spare_parts_cost = 0.0
                for sp in order.spare_parts:
                    cost = sp.unit_cost_at_time or 0.0
                    spare_parts_cost += sp.quantity_requested * cost

                # El horómetro al momento del mantenimiento se puede deducir
                # de next_service_horometer - 250
                horometer_at_time = (
                    order.next_service_horometer - 250.0
                    if order.next_service_horometer is not None
                    else machine.current_horometer
                )

                history_items.append(
                    TechnicalHistoryItem(
                        order_id=UUID(str(order.id)),
                        date=order.created_at,
                        description=order.description,
                        mechanic_name=mechanic_name,
                        spare_parts_cost=spare_parts_cost,
                        total_cost=spare_parts_cost,
                        horometer_at_time=horometer_at_time,
                        failure_category=order.failure_category,
                        failure_category_label=failure_category_label(
                            order.failure_category
                        ),
                        # spec 5.1: la descripción del trabajo realizado queda en
                        # el historial del activo.
                        work_performed=order.work_performed,
                    )
                )

        return MachineTechnicalHistoryResponse(
            machine_id=machine_id,
            machine_code=machine.code,
            maintenance_count=len(history_items),
            history=history_items,
        )
