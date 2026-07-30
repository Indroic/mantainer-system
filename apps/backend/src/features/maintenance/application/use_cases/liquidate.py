from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.application.dtos import (
    LiquidateMaintenanceCommand,
    MaintenanceResponse,
    MaintenanceSparePartResponse,
)
from src.features.maintenance.domain.entities import failure_category_label
from src.features.maintenance.domain.services import MaintenanceDomainService


class LiquidateMaintenanceUseCase(
    UseCase[LiquidateMaintenanceCommand, MaintenanceResponse]
):
    def __init__(self, service: MaintenanceDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: LiquidateMaintenanceCommand) -> MaintenanceResponse:
        from src.features.audit.domain.entities import AuditLog
        from src.features.audit.infrastructure.repositories import AuditLogRepository
        from src.features.notifications.domain.entities import (
            NotificationSeverity,
            NotificationType,
        )
        from src.features.notifications.infrastructure.routes import (
            build_notification_service,
        )

        async with self.uow:
            order = await self.service.liquidate_order(
                order_id=command.order_id,
                work_performed=command.work_performed,
            )

            # Registrar Auditoría Forense Activa
            audit_repo = AuditLogRepository(self.uow)
            await audit_repo.save(
                AuditLog(
                    entity_name="MaintenanceOrder",
                    entity_id=order.id,
                    action="LIQUIDATE",
                    payload={
                        "status": order.status,
                        "next_service_horometer": order.next_service_horometer,
                        "spare_parts_count": len(order.spare_parts),
                        "work_performed": order.work_performed,
                    },
                    performed_by=command.performed_by or "system",
                )
            )

            # ----------------------------------------------------------------
            # spec 3.1: el Planificador recibe una notificación automática en el
            # instante en que la OT es liquidada/cerrada por el Mecánico.
            # ----------------------------------------------------------------
            machine_code = await self._resolve_machine_code(order.machine_id)
            notifications = build_notification_service(self.uow)
            await notifications.notify_event(
                NotificationType.OT_LIQUIDADA,
                title="Orden de Trabajo liquidada",
                message=(
                    f"La OT de la maquinaria {machine_code} "
                    f"({failure_category_label(order.failure_category)}) fue liquidada y cerrada. "
                    f"Próximo servicio a las {order.next_service_horometer or 0:.1f} h. "
                    f"Trabajo realizado: {order.work_performed or 'sin detalle registrado'}."
                ),
                severity=NotificationSeverity.INFO,
                link=f"/mantenimiento/{order.id}",
                related_entity_id=order.id,
            )

            await self.uow.commit()

        return MaintenanceResponse(
            id=order.id,
            machine_id=order.machine_id,
            description=order.description,
            status=order.status,
            assigned_mechanic_id=order.assigned_mechanic_id,
            next_service_horometer=order.next_service_horometer,
            failure_category=order.failure_category,
            failure_category_label=failure_category_label(order.failure_category),
            work_performed=order.work_performed,
            created_by=order.created_by,
            spare_parts=[
                MaintenanceSparePartResponse(
                    id=sp.id,
                    spare_part_id=sp.spare_part_id,
                    quantity_requested=sp.quantity_requested,
                    quantity=sp.quantity_requested,
                    unit_cost_at_time=sp.unit_cost_at_time,
                )
                for sp in order.spare_parts
            ],
            solvencies=[],
            created_at=order.created_at,
            updated_at=order.updated_at,
            is_active=order.is_active,
        )

    async def _resolve_machine_code(self, machine_id) -> str:
        from src.features.machine.infrastructure.repositories import MachineRepository

        try:
            machine = await MachineRepository(self.uow).get_by_id(machine_id)
            return machine.code
        except Exception:
            return str(machine_id)
