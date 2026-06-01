from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.maintenance.application.dtos import (
    CreateMaintenanceCommand,
    MaintenanceResponse,
)
from src.features.maintenance.domain.services import MaintenanceDomainService
from src.features.maintenance.infrastructure.repositories import (
    MaintenanceOrderRepository,
)
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.user.infrastructure.repositories import UserRepository


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
            spare_parts=[],
            created_at=order.created_at,
            updated_at=order.updated_at,
            is_active=order.is_active,
        )
