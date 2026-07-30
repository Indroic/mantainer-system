from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.application.dtos import (
    CreateMaintenanceCommand,
    MaintenanceResponse,
)
from src.features.maintenance.domain.entities import failure_category_label
from src.features.maintenance.domain.services import MaintenanceDomainService


class CreateMaintenanceUseCase(UseCase[CreateMaintenanceCommand, MaintenanceResponse]):
    def __init__(self, service: MaintenanceDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: CreateMaintenanceCommand) -> MaintenanceResponse:
        async with self.uow:
            order = await self.service.create_order(
                machine_id=command.machine_id,
                description=command.description,
                assigned_mechanic_id=command.assigned_mechanic_id,
                failure_category=command.failure_category,
                created_by=command.performed_by,
            )

            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="MaintenanceOrder",
                entity_id=order.id,
                action="CREATE",
                payload={
                    "machine_id": str(order.machine_id),
                    "description": order.description,
                    "assigned_mechanic_id": str(order.assigned_mechanic_id),
                    "failure_category": (
                        order.failure_category.value if order.failure_category else None
                    ),
                    "status": order.status,
                },
                performed_by=command.performed_by or "system",
            )
            await audit_repo.save(audit_log)

            # ----------------------------------------------------------------
            # spec 2.2: al crear una OT (Supervisor o Mecánico), el Planificador
            # recibe automáticamente una notificación para revisarla y asignar
            # los repuestos necesarios.
            # ----------------------------------------------------------------
            from src.features.notifications.domain.entities import (
                NotificationSeverity,
                NotificationType,
            )
            from src.features.notifications.infrastructure.routes import (
                build_notification_service,
            )

            machine_code = await self._resolve_machine_code(order.machine_id)
            notifications = build_notification_service(self.uow)
            await notifications.notify_event(
                NotificationType.OT_CREADA,
                title="Nueva OT pendiente de asignación de repuestos",
                message=(
                    f"Se registró una Orden de Trabajo para la maquinaria {machine_code} "
                    f"({failure_category_label(order.failure_category)}): {order.description}. "
                    f"Revise la OT y asigne los repuestos necesarios."
                ),
                severity=NotificationSeverity.WARNING,
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
            spare_parts=[],
            solvencies=[],
            created_at=order.created_at,
            updated_at=order.updated_at,
            is_active=order.is_active,
        )

    async def _resolve_machine_code(self, machine_id) -> str:
        """Código legible de la máquina para el texto de la notificación."""
        from src.features.machine.infrastructure.repositories import MachineRepository

        try:
            machine = await MachineRepository(self.uow).get_by_id(machine_id)
            return machine.code
        except Exception:
            return str(machine_id)
