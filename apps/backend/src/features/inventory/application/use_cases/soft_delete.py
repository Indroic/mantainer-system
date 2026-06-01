from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.inventory.application.dtos import (
    SoftDeleteSparePartCommand,
    SparePartResponse,
)
from src.features.inventory.domain.services import InventoryDomainService


class SoftDeleteSparePartUseCase(
    UseCase[SoftDeleteSparePartCommand, SparePartResponse]
):
    def __init__(self, service: InventoryDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: SoftDeleteSparePartCommand) -> SparePartResponse:
        async with self.uow:
            spare_part = await self.service.soft_delete(spare_part_id=command.spare_part_id)
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="SparePart",
                entity_id=spare_part.id,
                action="SOFT_DELETE",
                payload={
                    "is_active": spare_part.is_active
                },
                performed_by=command.performed_by or "system"
            )
            await audit_repo.save(audit_log)
            
            await self.uow.commit()

        return SparePartResponse(
            id=spare_part.id,
            code=spare_part.code,
            name=spare_part.name,
            stock_current=spare_part.stock_current,
            stock_minimum=spare_part.stock_minimum,
            unit_cost=spare_part.unit_cost,
            created_at=spare_part.created_at,
            updated_at=spare_part.updated_at,
            is_active=spare_part.is_active,
        )
