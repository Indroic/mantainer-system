from enum import Enum
from hexcore.domain.base import BaseEntity


class MachineStatus(str, Enum):
    ACTIVA = "ACTIVA"
    EN_MANTENIMIENTO = "EN_MANTENIMIENTO"
    FUERA_DE_SERVICIO = "FUERA_DE_SERVICIO"
    DADA_DE_BAJA = "DADA_DE_BAJA"


class HorometerUnit(str, Enum):
    HORAS = "Horas"
    KM = "Kilómetros"
    MILLAS = "Millas"


class Machine(BaseEntity):
    code: str
    motor_serial: str
    brand: str
    model: str
    manufacture_year: int
    current_horometer: float = 0.0
    status: MachineStatus = MachineStatus.ACTIVA
    horometer_unit: HorometerUnit = HorometerUnit.HORAS
    description: str | None = None
    location: str | None = None

    def update_horometer(self, new_value: float) -> None:
        """Actualiza el horómetro actual de la máquina validando que sea incremental y que la máquina no esté dada de baja."""
        from src.features.machine.domain.exceptions import (
            MachineIsReadOnlyException,
            MachineInvalidHorometerException,
        )

        if self.status == MachineStatus.DADA_DE_BAJA:
            raise MachineIsReadOnlyException(self.code)

        if new_value < self.current_horometer:
            raise MachineInvalidHorometerException(self.current_horometer, new_value)

        self.current_horometer = new_value

    def change_status(self, new_status: MachineStatus) -> None:
        """Cambia el estado operativo de la máquina."""
        from src.features.machine.domain.exceptions import MachineIsReadOnlyException

        # Si está dada de baja, pasa a ser de solo lectura y no se puede reactivar ni cambiar estado
        if self.status == MachineStatus.DADA_DE_BAJA:
            raise MachineIsReadOnlyException(self.code)

        self.status = new_status

    def soft_delete(self) -> None:
        """Aplica la baja lógica."""
        self.is_active = False
