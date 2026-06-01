from uuid import UUID
from hexcore.domain.services import BaseDomainService
from src.features.machine.domain.entities import MachineStatus
from src.features.maintenance.domain.entities import (
    MaintenanceOrder,
    MaintenanceSparePart,
)
from src.features.user.domain.entities import UserRole


class MaintenanceDomainService(BaseDomainService):
    def __init__(
        self,
        maintenance_repo,
        machine_repo,
        spare_part_repo,
        user_metadata_repo,
    ) -> None:
        self._repo = maintenance_repo
        self._machine_repo = machine_repo
        self._spare_part_repo = spare_part_repo
        self._user_metadata_repo = user_metadata_repo
        super().__init__()

    async def get_by_id(self, order_id: UUID) -> MaintenanceOrder:
        """Obtiene una orden de trabajo por su ID."""
        return await self._repo.get_by_id(order_id)

    async def create_order(
        self, machine_id: UUID, description: str, assigned_mechanic_id: UUID
    ) -> MaintenanceOrder:
        """Registra y programa una nueva orden de trabajo."""
        # Validar existencia de la máquina y mecánico asignado
        machine = await self._machine_repo.get_by_id(machine_id)
        mechanic = await self._user_metadata_repo.get_by_id(assigned_mechanic_id)

        if mechanic.role != UserRole.MECANICO:
            raise ValueError(
                f"El usuario asignado debe tener el rol de Mecánico. Rol actual: '{mechanic.role.value}'."
            )

        order = MaintenanceOrder(
            machine_id=machine.id,
            description=description,
            assigned_mechanic_id=mechanic.id,
        )
        await self._repo.save(order)
        return order

    async def start_execution(self, order_id: UUID) -> MaintenanceOrder:
        """Pone en ejecución la orden de trabajo y cambia la máquina a EN_MANTENIMIENTO."""
        order = await self.get_by_id(order_id)
        order.start_execution()

        # Cambiar el estado de la máquina asociada
        machine = await self._machine_repo.get_by_id(order.machine_id)
        machine.change_status(MachineStatus.EN_MANTENIMIENTO)

        await self._machine_repo.save(machine)
        await self._repo.save(order)
        return order

    async def add_spare_part(
        self, order_id: UUID, spare_part_id: UUID, quantity: int
    ) -> MaintenanceSparePart:
        """Registra repuestos requeridos durante la ejecución de la orden."""
        order = await self.get_by_id(order_id)

        # Validamos que exista el repuesto en inventario
        spare_part = await self._spare_part_repo.get_by_id(spare_part_id)

        # Agregamos a la orden en memoria
        req = order.add_spare_part(spare_part.id, quantity)

        # Persistimos la orden para actualizar la lista en BD
        await self._repo.save(order)
        return req

    async def liquidate_order(self, order_id: UUID) -> MaintenanceOrder:
        """Liquida la orden de trabajo realizando descuentos de stock de repuestos y cálculos del próximo mantenimiento."""
        order = await self.get_by_id(order_id)

        # Cargar dependencia de negocio: Máquina
        machine = await self._machine_repo.get_by_id(order.machine_id)

        # Ejecutamos las reglas de dominio para liquidación
        order.liquidate(
            current_horometer=machine.current_horometer,
        )

        # Realizar transacciones ACID sobre inventario y costos históricos
        for req in order.spare_parts:
            # Obtener el repuesto correspondiente en el inventario
            spare_part = await self._spare_part_repo.get_by_id(req.spare_part_id)

            # 1. Establecemos el costo histórico
            req.set_unit_cost(spare_part.unit_cost)

            # 2. Descontamos el stock (arrojará excepción si queda en negativo)
            spare_part.decrease_stock(req.quantity_requested)

            # Guardamos el repuesto con stock descontado
            await self._spare_part_repo.save(spare_part)

        # Devolver la máquina vinculada a estado ACTIVA
        machine.change_status(MachineStatus.ACTIVA)

        # Guardar máquina y orden liquidadas
        await self._machine_repo.save(machine)
        await self._repo.save(order)
        return order

