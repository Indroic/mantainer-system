from uuid import UUID
from hexcore.domain.services import BaseDomainService
from src.features.machine.domain.entities import MachineStatus
from src.features.maintenance.domain.entities import (
    FailureCategory,
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
        self,
        machine_id: UUID,
        description: str,
        assigned_mechanic_id: UUID,
        failure_category: FailureCategory | None = None,
        created_by: str | None = None,
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
            failure_category=failure_category,
            created_by=created_by,
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
    ) -> tuple[MaintenanceOrder, MaintenanceSparePart]:
        """Registra un repuesto requerido en la orden de trabajo.

        Devuelve también la orden porque quien invoca necesita su contexto
        (máquina, mecánico asignado, creador) para emitir la Solvencia de
        Repuestos y las notificaciones asociadas (spec 3.3).
        """
        order = await self.get_by_id(order_id)

        # Validamos que exista el repuesto en inventario
        spare_part = await self._spare_part_repo.get_by_id(spare_part_id)

        # Agregamos a la orden en memoria
        req = order.add_spare_part(spare_part.id, quantity)

        # Persistimos la orden para actualizar la lista en BD
        await self._repo.save(order)
        return order, req

    async def classify_failure(
        self, order_id: UUID, failure_category: FailureCategory | None
    ) -> MaintenanceOrder:
        """Asigna o corrige la categoría de falla de una OT existente."""
        order = await self.get_by_id(order_id)
        order.classify_failure(failure_category)
        await self._repo.save(order)
        return order

    async def liquidate_order(
        self, order_id: UUID, work_performed: str | None = None
    ) -> MaintenanceOrder:
        """Liquida la orden de trabajo realizando descuentos de stock de repuestos y cálculos del próximo mantenimiento."""
        order = await self.get_by_id(order_id)

        # Cargar dependencia de negocio: Máquina
        machine = await self._machine_repo.get_by_id(order.machine_id)

        # Ejecutamos las reglas de dominio para liquidación
        order.liquidate(
            current_horometer=machine.current_horometer,
            work_performed=work_performed,
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
