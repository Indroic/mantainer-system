from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine_type.application.dtos import (
    CreateMachineTypeCommand,
    MachineTypeResponse,
)
from src.features.machine_type.domain.entities import MachineType
from src.features.machine_type.infrastructure.repositories import MachineTypeRepository


class CreateMachineTypeUseCase(
    UseCase[CreateMachineTypeCommand, MachineTypeResponse]
):
    def __init__(self, repo: MachineTypeRepository, uow: SqlAlchemyUnitOfWork) -> None:
        self.repo = repo
        self.uow = uow

    async def execute(self, command: CreateMachineTypeCommand) -> MachineTypeResponse:
        from src.features.machine_type.domain.exceptions import (
            MachineTypeAlreadyExistsException,
        )

        async with self.uow:
            existing = await self.repo.get_by_name(command.name.strip())
            if existing is not None:
                raise MachineTypeAlreadyExistsException(command.name.strip())

            machine_type = MachineType(
                name=command.name.strip(),
                description=command.description.strip() if command.description else None,
            )
            await self.repo.save(machine_type)

            from src.features.audit.domain.entities import AuditLog
            from src.features.audit.infrastructure.repositories import AuditLogRepository

            audit_repo = AuditLogRepository(self.uow)
            await audit_repo.save(
                AuditLog(
                    entity_name="MachineType",
                    entity_id=machine_type.id,
                    action="CREATE",
                    payload={
                        "name": machine_type.name,
                        "description": machine_type.description,
                    },
                    performed_by=command.performed_by or "system",
                )
            )

            await self.uow.commit()

        return MachineTypeResponse(
            id=machine_type.id,
            name=machine_type.name,
            description=machine_type.description,
            created_at=machine_type.created_at,
            updated_at=machine_type.updated_at,
            is_active=machine_type.is_active,
        )
