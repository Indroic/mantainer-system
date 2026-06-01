from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.audit.application.dtos import (
    AuditLogResponse,
    CreateAuditLogCommand,
)
from src.features.audit.domain.entities import AuditLog
from src.features.audit.infrastructure.repositories import AuditLogRepository


class CreateAuditLogUseCase(UseCase[CreateAuditLogCommand, AuditLogResponse]):
    def __init__(self, uow: SqlAlchemyUnitOfWork) -> None:
        self.uow = uow

    async def execute(self, command: CreateAuditLogCommand) -> AuditLogResponse:
        async with self.uow:
            repo = AuditLogRepository(self.uow)
            log = AuditLog(
                entity_name=command.entity_name,
                entity_id=command.entity_id,
                action=command.action,
                payload=command.payload,
                performed_by=command.performed_by,
            )
            await repo.save(log)
            await self.uow.commit()

        return AuditLogResponse(
            id=log.id,
            entity_name=log.entity_name,
            entity_id=log.entity_id,
            action=log.action,
            payload=log.payload,
            performed_by=log.performed_by,
            created_at=log.created_at,
            is_active=log.is_active,
        )
