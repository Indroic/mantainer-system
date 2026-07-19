from datetime import datetime
from uuid import UUID
from pydantic import field_validator
from hexcore.application.dtos.base import DTO
from src.features.machine.domain.entities import MachineStatus, HorometerUnit


class CreateMachineCommand(DTO):
    code: str
    motor_serial: str
    brand: str
    model: str
    manufacture_year: int
    current_horometer: float = 0.0
    horometer_unit: HorometerUnit = HorometerUnit.HORAS
    description: str | None = None
    location: str | None = None
    performed_by: str | None = None

    @field_validator("motor_serial")
    @classmethod
    def motor_serial_no_at(cls, v: str) -> str:
        if "@" in v:
            raise ValueError("El serial del motor no puede contener el carácter '@'")
        return v


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
    horometer_unit: HorometerUnit = HorometerUnit.HORAS
    description: str | None = None
    location: str | None = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
