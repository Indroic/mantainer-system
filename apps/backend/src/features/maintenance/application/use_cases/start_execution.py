from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.application.dtos import (
    MaintenanceResponse,
    MaintenanceSparePartResponse,
    StartMaintenanceCommand,
)
from src.features.maintenance.domain.services import MaintenanceDomainService


class StartMaintenanceUseCase(UseCase[StartMaintenanceCommand, MaintenanceResponse]):
    def __init__(self, service: MaintenanceDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: StartMaintenanceCommand) -> MaintenanceResponse:
        async with self.uow:
            order = await self.service.start_execution(order_id=command.order_id)
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="MaintenanceOrder",
                entity_id=order.id,
                action="START_EXECUTION",
                payload={
                    "status": order.status
                },
                performed_by=command.performed_by or "system"
            )
            await audit_repo.save(audit_log)
            
            await self.uow.commit()

        return MaintenanceResponse(
            id=order.id,
            machine_id=order.machine_id,
            description=order.description,
            status=order.status,
            assigned_mechanic_id=order.assigned_mechanic_id,
            next_service_horometer=order.next_service_horometer,
            spare_parts=[
                MaintenanceSparePartResponse(
                    id=sp.id,
                    spare_part_id=sp.spare_part_id,
                    quantity_requested=sp.quantity_requested,
                    unit_cost_at_time=sp.unit_cost_at_time,
                )
                for sp in order.spare_parts
            ],
            created_at=order.created_at,
            updated_at=order.updated_at,
            is_active=order.is_active,
        )
