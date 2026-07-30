from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.application.dtos import (
    MaintenanceResponse,
    MaintenanceSparePartResponse,
    ReturnSparePartCommand,
)
from src.features.maintenance.domain.entities import failure_category_label
from src.features.maintenance.domain.services import MaintenanceDomainService
from src.features.notifications.domain.entities import (
    NotificationSeverity,
    NotificationType,
)
from src.features.user.domain.entities import UserRole


class ReturnSparePartUseCase(
    UseCase[ReturnSparePartCommand, MaintenanceResponse]
):
    def __init__(self, service: MaintenanceDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: ReturnSparePartCommand) -> MaintenanceResponse:
        from src.features.audit.domain.entities import AuditLog
        from src.features.audit.infrastructure.repositories import AuditLogRepository
        from src.features.notifications.infrastructure.routes import (
            build_notification_service,
        )
        from src.features.solvency.infrastructure.routes import build_solvency_service

        async with self.uow:
            order = await self.service.return_spare_part(
                order_id=command.order_id,
                spare_part_id=command.spare_part_id,
                quantity=command.quantity,
            )

            # --- 1. Solvencia de devolución con folio ``DEV-AAAA-NNNN`` --------
            solvency_service = build_solvency_service(self.uow)
            solvency = await solvency_service.issue_for_return(
                maintenance_order_id=order.id,
                machine_id=order.machine_id,
                issued_by=command.performed_by or "system",
                items=[(command.spare_part_id, command.quantity)],
                notes=f"Devolución de repuestos a la OT: {order.description}",
            )

            # --- 2. Notificación ----------------------------------------------
            notifications = build_notification_service(self.uow)
            await notifications.notify_roles(
                [UserRole.PLANIFICADOR, UserRole.SUPERVISOR, UserRole.ALMACEN],
                type=NotificationType.SOLVENCIA_EMITIDA,
                title=f"Devolución de repuestos · {solvency.code}",
                message=(
                    f"Se devolvieron {command.quantity} unidad(es) al inventario "
                    f"desde la OT de la maquinaria "
                    f"{solvency.machine_code or order.machine_id}. "
                    f"Documento {solvency.code} emitido."
                ),
                severity=NotificationSeverity.INFO,
                link=f"/mantenimiento/{order.id}",
                related_entity_id=solvency.id,
            )

            # --- 3. Auditoría forense -----------------------------------------
            audit_repo = AuditLogRepository(self.uow)
            await audit_repo.save(
                AuditLog(
                    entity_name="MaintenanceSparePart",
                    entity_id=command.spare_part_id,
                    action="RETURN_SPARE_PART",
                    payload={
                        "maintenance_order_id": str(command.order_id),
                        "spare_part_id": str(command.spare_part_id),
                        "quantity_returned": command.quantity,
                        "solvency_code": solvency.code,
                        "solvency_id": str(solvency.id),
                    },
                    performed_by=command.performed_by or "system",
                )
            )

            await self.uow.commit()

        from src.features.machine.infrastructure.repositories import MachineRepository
        machine_dto = None
        try:
            machine = await MachineRepository(self.uow).get_by_id(order.machine_id)
            machine_type_name = None
            if getattr(machine, 'machine_type_id', None):
                try:
                    from src.features.machine_type.infrastructure.repositories import (
                        MachineTypeRepository,
                    )
                    mt = await MachineTypeRepository(self.uow).get_by_id(
                        machine.machine_type_id
                    )
                    machine_type_name = mt.name
                except Exception:
                    pass
            from src.features.machine.application.dtos import MachineResponse as MachineDTOResponse
            machine_dto = MachineDTOResponse(
                id=machine.id, code=machine.code, motor_serial=machine.motor_serial,
                brand=machine.brand, model=machine.model,
                manufacture_year=machine.manufacture_year,
                current_horometer=machine.current_horometer,
                status=machine.status,
                horometer_unit=getattr(machine, 'horometer_unit', 'Horas'),
                description=getattr(machine, 'description', None),
                location=getattr(machine, 'location', None),
                machine_type_id=getattr(machine, 'machine_type_id', None),
                machine_type_name=machine_type_name,
                created_at=machine.created_at, updated_at=machine.updated_at,
                is_active=machine.is_active,
            )
        except Exception:
            pass

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
                    quantity_returned=sp.quantity_returned,
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
