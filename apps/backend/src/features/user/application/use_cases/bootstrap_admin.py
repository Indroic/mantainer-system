from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.user.application.dtos import (
    BootstrapAdminCommand,
    UserMetadataResponse,
)
from src.features.user.domain.services import UserMetadataDomainService


class BootstrapInitialAdminUseCase(
    UseCase[BootstrapAdminCommand, UserMetadataResponse]
):
    """Registra al administrador inicial del sistema (solo si no existe ninguno)."""

    def __init__(self, service: UserMetadataDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: BootstrapAdminCommand) -> UserMetadataResponse:
        async with self.uow:
            metadata = await self.service.bootstrap_initial_admin(
                better_auth_user_id=command.better_auth_user_id or "",
                hourly_rate=command.hourly_rate,
            )

            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog

            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="UserMetadata",
                entity_id=metadata.id,
                action="BOOTSTRAP_ADMIN",
                payload={
                    "better_auth_user_id": metadata.better_auth_user_id,
                    "role": str(metadata.role),
                    "hourly_rate": metadata.hourly_rate,
                },
                performed_by=metadata.better_auth_user_id,
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
