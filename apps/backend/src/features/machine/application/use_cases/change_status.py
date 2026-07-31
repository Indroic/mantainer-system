from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.application.dtos import (
    ChangeMachineStatusCommand,
    MachineResponse,
)
from src.features.machine.domain.services import MachineDomainService


class ChangeMachineStatusUseCase(
    UseCase[ChangeMachineStatusCommand, MachineResponse]
):
    def __init__(self, service: MachineDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: ChangeMachineStatusCommand) -> MachineResponse:
        async with self.uow:
            # Obtener estado previo para auditoría
            from src.features.machine.infrastructure.repositories import MachineRepository
            m_repo = MachineRepository(self.uow)
            old_machine = await m_repo.get_by_id(command.machine_id)
            old_status = old_machine.status

            machine = await self.service.change_status(
                machine_id=command.machine_id,
                new_status=command.status,
            )
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="Machine",
                entity_id=machine.id,
                action="CHANGE_STATUS",
                payload={
                    "previous": {"status": old_status},
                    "current": {"status": machine.status}
                },
                performed_by=command.performed_by or "system"
            )
            await audit_repo.save(audit_log)
            
            await self.uow.commit()

        machine_type_name = await self._resolve_machine_type_name(machine.machine_type_id)

        return MachineResponse(
            id=machine.id,
            code=machine.code,
            motor_serial=machine.motor_serial,
            brand=machine.brand,
            model=machine.model,
            manufacture_year=machine.manufacture_year,
            current_horometer=machine.current_horometer,
            status=machine.status,
            horometer_unit=machine.horometer_unit,
            description=machine.description,
            location=machine.location,
            machine_type_id=str(machine.machine_type_id) if machine.machine_type_id else None,
            machine_type_name=machine_type_name,
            created_at=machine.created_at,
            updated_at=machine.updated_at,
            is_active=machine.is_active,
        )

    async def _resolve_machine_type_name(self, machine_type_id) -> str | None:
        if not machine_type_id:
            return None
        try:
            from src.features.machine_type.infrastructure.repositories import (
                MachineTypeRepository,
            )
            mt = await MachineTypeRepository(self.uow).get_by_id(machine_type_id)
            return mt.name
        except Exception:
            return None
