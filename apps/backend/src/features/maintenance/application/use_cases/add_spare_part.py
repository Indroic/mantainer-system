from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.application.dtos import (
    AddSparePartToOrderCommand,
    MaintenanceSparePartResponse,
)
from src.features.maintenance.domain.services import MaintenanceDomainService
from src.features.notifications.domain.entities import (
    NotificationSeverity,
    NotificationType,
)
from src.features.user.domain.entities import UserRole


class AddSparePartToOrderUseCase(
    UseCase[AddSparePartToOrderCommand, MaintenanceSparePartResponse]
):
    """Asigna un repuesto a una OT y desencadena el flujo de la spec 3.3.

    En una sola transacción:
      1. Registra el repuesto requerido en la Orden de Trabajo.
      2. Emite automáticamente el documento de "Solvencia de repuestos" con su
         numeración interna secuencial (``SOLV-AAAA-NNNN``).
      3. Notifica simultáneamente al Supervisor a cargo, al Mecánico asignado y
         al usuario de Almacén.
      4. Deja traza en la bitácora de auditoría.
    """

    def __init__(self, service: MaintenanceDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: AddSparePartToOrderCommand) -> MaintenanceSparePartResponse:
        from src.features.audit.domain.entities import AuditLog
        from src.features.audit.infrastructure.repositories import AuditLogRepository
        from src.features.notifications.infrastructure.routes import (
            build_notification_service,
        )
        from src.features.solvency.infrastructure.routes import build_solvency_service

        async with self.uow:
            order, sp_req = await self.service.add_spare_part(
                order_id=command.order_id,
                spare_part_id=command.spare_part_id,
                quantity=command.quantity,
            )

            # --- 1. Solvencia de repuestos con folio secuencial --------------
            solvency_service = build_solvency_service(self.uow)
            solvency = await solvency_service.issue_for_assignment(
                maintenance_order_id=order.id,
                machine_id=order.machine_id,
                issued_by=command.performed_by or "system",
                items=[(sp_req.spare_part_id, sp_req.quantity_requested)],
                notes=f"Repuestos autorizados para la OT: {order.description}",
            )

            # --- 2. Notificación simultánea ---------------------------------
            # Supervisor(es) y Almacén por rol; el Mecánico asignado y el
            # creador de la OT de forma explícita, para no depender de que todos
            # los mecánicos reciban un aviso que no les corresponde.
            direct_recipients = await self._direct_recipients(order)
            spare_part_label = (
                f"{solvency.items[0].spare_part_name} ({solvency.items[0].spare_part_code})"
                if solvency.items
                else "el repuesto solicitado"
            )

            notifications = build_notification_service(self.uow)
            await notifications.notify_roles(
                [UserRole.SUPERVISOR, UserRole.ALMACEN],
                type=NotificationType.SOLVENCIA_EMITIDA,
                title=f"Solvencia de repuestos emitida · {solvency.code}",
                message=(
                    f"El Planificador asignó {sp_req.quantity_requested} unidad(es) de "
                    f"{spare_part_label} a la OT de la maquinaria "
                    f"{solvency.machine_code or order.machine_id}. "
                    f"Documento {solvency.code} listo para despacho."
                ),
                severity=NotificationSeverity.INFO,
                link=f"/mantenimiento/{order.id}",
                related_entity_id=solvency.id,
                extra_user_ids=direct_recipients,
            )

            # --- 3. Auditoría forense ---------------------------------------
            audit_repo = AuditLogRepository(self.uow)
            await audit_repo.save(
                AuditLog(
                    entity_name="MaintenanceSparePart",
                    entity_id=sp_req.id,
                    action="ADD_SPARE_PART",
                    payload={
                        "maintenance_order_id": str(sp_req.maintenance_order_id),
                        "spare_part_id": str(sp_req.spare_part_id),
                        "quantity_requested": sp_req.quantity_requested,
                        "solvency_code": solvency.code,
                        "solvency_id": str(solvency.id),
                    },
                    performed_by=command.performed_by or "system",
                )
            )

            await self.uow.commit()

        return MaintenanceSparePartResponse(
            id=sp_req.id,
            spare_part_id=sp_req.spare_part_id,
            quantity_requested=sp_req.quantity_requested,
            quantity=sp_req.quantity_requested,
            unit_cost_at_time=sp_req.unit_cost_at_time,
        )

    async def _direct_recipients(self, order) -> list[str]:
        """IDs de Better Auth del Mecánico asignado y del creador de la OT."""
        from src.features.user.infrastructure.repositories import UserRepository

        recipients: list[str] = []

        try:
            mechanic_metadata = await UserRepository(self.uow).get_by_id(
                order.assigned_mechanic_id
            )
            if mechanic_metadata and mechanic_metadata.better_auth_user_id:
                recipients.append(mechanic_metadata.better_auth_user_id)
        except Exception:
            # Si el mecánico no se puede resolver, la notificación por rol sigue
            # llegando al Supervisor y a Almacén.
            pass

        if order.created_by:
            recipients.append(order.created_by)

        return recipients
