from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.application.dtos import (
    MachineResponse,
    UpdateMachineHorometerCommand,
)
from src.features.machine.domain.services import MachineDomainService


class UpdateMachineHorometerUseCase(
    UseCase[UpdateMachineHorometerCommand, MachineResponse]
):
    def __init__(self, service: MachineDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: UpdateMachineHorometerCommand) -> MachineResponse:
        async with self.uow:
            # Obtener estado previo para auditoría
            from src.features.machine.infrastructure.repositories import MachineRepository
            m_repo = MachineRepository(self.uow)
            old_machine = await m_repo.get_by_id(command.machine_id)
            old_horometer = old_machine.current_horometer

            machine = await self.service.update_horometer(
                machine_id=command.machine_id,
                new_horometer=command.new_horometer,
            )
            
            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="Machine",
                entity_id=machine.id,
                action="UPDATE_HOROMETER",
                payload={
                    "previous": {"current_horometer": old_horometer},
                    "current": {"current_horometer": machine.current_horometer}
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
            machine_type_id=machine.machine_type_id,
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
