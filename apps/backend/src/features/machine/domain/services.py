from hexcore.domain.services import BaseDomainService
from src.features.machine.domain.entities import Machine, MachineStatus, HorometerUnit


class MachineDomainService(BaseDomainService):
    def __init__(self, machine_repo) -> None:
        self._repo = machine_repo
        super().__init__()

    async def get_by_id(self, machine_id) -> Machine:
        """Obtiene una máquina por su ID del repositorio."""
        return await self._repo.get_by_id(machine_id)

    async def create_machine(
        self,
        code: str,
        motor_serial: str,
        brand: str,
        model: str,
        manufacture_year: int,
        current_horometer: float,
        horometer_unit: HorometerUnit = HorometerUnit.HORAS,
        description: str | None = None,
        location: str | None = None,
        machine_type_id: str | None = None,
    ) -> Machine:
        """Crea y registra una nueva máquina."""
        machine = Machine(
            code=code,
            motor_serial=motor_serial,
            brand=brand,
            model=model,
            manufacture_year=manufacture_year,
            current_horometer=current_horometer,
            status=MachineStatus.ACTIVA,
            horometer_unit=horometer_unit,
            description=description,
            location=location,
            machine_type_id=machine_type_id,
        )
        await self._repo.save(machine)
        return machine

    async def update_horometer(self, machine_id, new_horometer: float) -> Machine:
        """Valida y actualiza el horómetro de una máquina."""
        machine = await self.get_by_id(machine_id)
        machine.update_horometer(new_horometer)
        await self._repo.save(machine)
        return machine

    async def change_status(self, machine_id, new_status: MachineStatus) -> Machine:
        """Valida y cambia el estado operativo de una máquina."""
        machine = await self.get_by_id(machine_id)
        machine.change_status(new_status)
        await self._repo.save(machine)
        return machine

    async def soft_delete(self, machine_id) -> Machine:
        """Realiza la baja lógica (soft delete) de una máquina."""
        machine = await self.get_by_id(machine_id)
        machine.soft_delete()
        await self._repo.save(machine)
        return machine
