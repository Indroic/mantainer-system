from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.inventory.application.dtos import (
    SparePartResponse,
    UpdateSparePartStockCommand,
)
from src.features.inventory.domain.services import InventoryDomainService


class UpdateSparePartStockUseCase(
    UseCase[UpdateSparePartStockCommand, SparePartResponse]
):
    def __init__(self, service: InventoryDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: UpdateSparePartStockCommand) -> SparePartResponse:
        async with self.uow:
            # Obtener estado previo para auditoría
            from src.features.inventory.infrastructure.repositories import SparePartRepository
            sp_repo = SparePartRepository(self.uow)
            old_part = await sp_repo.get_by_id(command.spare_part_id)
            old_stock = old_part.stock_current

            spare_part = await self.service.update_stock(
                spare_part_id=command.spare_part_id,
                new_stock=command.new_stock,
            )
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="SparePart",
                entity_id=spare_part.id,
                action="UPDATE_STOCK",
                payload={
                    "previous": {"stock_current": old_stock},
                    "current": {"stock_current": spare_part.stock_current}
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
