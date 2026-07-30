from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.application.dtos import CreateMachineCommand, MachineResponse
from src.features.machine.domain.services import MachineDomainService


class CreateMachineUseCase(UseCase[CreateMachineCommand, MachineResponse]):
    def __init__(self, service: MachineDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, command: CreateMachineCommand) -> MachineResponse:
        async with self.uow:
            machine = await self.service.create_machine(
                code=command.code,
                motor_serial=command.motor_serial,
                brand=command.brand,
                model=command.model,
                manufacture_year=command.manufacture_year,
                current_horometer=command.current_horometer,
                horometer_unit=command.horometer_unit,
                description=command.description,
                location=command.location,
                machine_type_id=command.machine_type_id,
            )

            # Registrar Auditoría Forense Activa
            from src.features.audit.infrastructure.repositories import AuditLogRepository
            from src.features.audit.domain.entities import AuditLog
            audit_repo = AuditLogRepository(self.uow)
            audit_log = AuditLog(
                entity_name="Machine",
                entity_id=machine.id,
                action="CREATE",
                payload={
                    "code": machine.code,
                    "motor_serial": machine.motor_serial,
                    "brand": machine.brand,
                    "model": machine.model,
                    "manufacture_year": machine.manufacture_year,
                    "current_horometer": machine.current_horometer,
                    "horometer_unit": machine.horometer_unit,
                    "status": machine.status,
                    "description": machine.description,
                    "location": machine.location,
                    "machine_type_id": machine.machine_type_id,
                },
                performed_by=command.performed_by or "system"
            )
            await audit_repo.save(audit_log)

            await self.uow.commit()

        machine_type_name = None
        if machine.machine_type_id:
            try:
                from src.features.machine_type.infrastructure.repositories import (
                    MachineTypeRepository,
                )
                mt = await MachineTypeRepository(self.uow).get_by_id(
                    machine.machine_type_id
                )
                machine_type_name = mt.name
            except Exception:
                pass

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
