from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.maintenance.application.dtos import (
    AddSparePartToOrderCommand,
    MaintenanceSparePartResponse,
)
from src.features.maintenance.domain.services import MaintenanceDomainService


class AddSparePartToOrderUseCase(
    UseCase[AddSparePartToOrderCommand, MaintenanceSparePartResponse]
):
    def __init__(self, service: MaintenanceDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: AddSparePartToOrderCommand) -> MaintenanceSparePartResponse:
        async with self.uow:
            sp_req = await self.service.add_spare_part(
                order_id=command.order_id,
                spare_part_id=command.spare_part_id,
                quantity=command.quantity,
            )
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="MaintenanceSparePart",
                entity_id=sp_req.id,
                action="ADD_SPARE_PART",
                payload={
                    "maintenance_order_id": str(sp_req.maintenance_order_id),
                    "spare_part_id": str(sp_req.spare_part_id),
                    "quantity_requested": sp_req.quantity_requested
                },
                performed_by=command.performed_by or "system"
            )
            await audit_repo.save(audit_log)
            
            await self.uow.commit()

        return MaintenanceSparePartResponse(
            id=sp_req.id,
            spare_part_id=sp_req.spare_part_id,
            quantity_requested=sp_req.quantity_requested,
            unit_cost_at_time=sp_req.unit_cost_at_time,
        )
