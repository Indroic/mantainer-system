from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO
from src.features.machine.domain.entities import MachineStatus


class CreateMachineCommand(DTO):
    code: str
    motor_serial: str
    brand: str
    model: str
    manufacture_year: int
    current_horometer: float = 0.0
    performed_by: str | None = None


class UpdateMachineHorometerCommand(DTO):
    machine_id: UUID
    new_horometer: float
    performed_by: str | None = None


class ChangeMachineStatusCommand(DTO):
    machine_id: UUID
    status: MachineStatus
    performed_by: str | None = None


class SoftDeleteMachineCommand(DTO):
    machine_id: UUID
    performed_by: str | None = None


class MachineResponse(DTO):
    id: UUID
    code: str
    motor_serial: str
    brand: str
    model: str
    manufacture_year: int
    current_horometer: float
    status: MachineStatus
    created_at: datetime
    updated_at: datetime
    is_active: bool
