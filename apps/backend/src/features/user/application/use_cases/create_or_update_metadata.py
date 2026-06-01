from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.user.application.dtos import (
    CreateOrUpdateUserMetadataCommand,
    UserMetadataResponse,
)
from src.features.user.domain.services import UserMetadataDomainService


class CreateOrUpdateUserMetadataUseCase(
    UseCase[CreateOrUpdateUserMetadataCommand, UserMetadataResponse]
):
    def __init__(self, service: UserMetadataDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: CreateOrUpdateUserMetadataCommand) -> UserMetadataResponse:
        async with self.uow:
            metadata = await self.service.create_or_update_metadata(
                better_auth_user_id=command.better_auth_user_id,
                role=command.role,
                hourly_rate=command.hourly_rate,
            )
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="UserMetadata",
                entity_id=metadata.id,
                action="CREATE_OR_UPDATE",
                payload={
                    "better_auth_user_id": metadata.better_auth_user_id,
                    "role": str(metadata.role),
                    "hourly_rate": metadata.hourly_rate
                },
                performed_by=command.performed_by or "system"
            )
            await audit_repo.save(audit_log)
            
            await self.uow.commit()

        return UserMetadataResponse(
            id=metadata.id,
            better_auth_user_id=metadata.better_auth_user_id,
            role=metadata.role,
            hourly_rate=metadata.hourly_rate,
            created_at=metadata.created_at,
            updated_at=metadata.updated_at,
            is_active=metadata.is_active,
        )
