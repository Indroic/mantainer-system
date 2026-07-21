from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.inventory.application.dtos import (
    CreateSparePartCommand,
    SparePartResponse,
)
from src.features.inventory.domain.services import InventoryDomainService


class CreateSparePartUseCase(UseCase[CreateSparePartCommand, SparePartResponse]):
    def __init__(self, service: InventoryDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: CreateSparePartCommand) -> SparePartResponse:
        async with self.uow:
            spare_part = await self.service.create_spare_part(
                code=command.code,
                name=command.name,
                stock_minimum=command.stock_minimum,
                unit_cost=command.unit_cost,
                stock_current=command.stock_current,
                part_number=command.part_number,
                unit_of_measure=command.unit_of_measure,
                internal_code=command.internal_code,
                unit_cost_usd=command.unit_cost_usd,
            )
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="SparePart",
                entity_id=spare_part.id,
                action="CREATE",
                payload={
                    "code": spare_part.code,
                    "name": spare_part.name,
                    "stock_minimum": spare_part.stock_minimum,
                    "stock_current": spare_part.stock_current,
                    "unit_cost": spare_part.unit_cost
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
            part_number=spare_part.part_number,
            unit_of_measure=spare_part.unit_of_measure,
            internal_code=spare_part.internal_code,
            unit_cost_usd=spare_part.unit_cost_usd,
            created_at=spare_part.created_at,
            updated_at=spare_part.updated_at,
            is_active=spare_part.is_active,
        )
