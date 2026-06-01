from enum import Enum
from uuid import UUID
from hexcore.domain.base import BaseEntity


class MaintenanceStatus(str, Enum):
    PROGRAMADO = "PROGRAMADO"
    EN_EJECUCION = "EN_EJECUCION"
    LIQUIDADO = "LIQUIDADO"


class MaintenanceSparePart(BaseEntity):
    maintenance_order_id: UUID
    spare_part_id: UUID
    quantity_requested: int
    unit_cost_at_time: float | None = None

    def set_unit_cost(self, cost: float) -> None:
        """Guarda el costo histórico unitario del repuesto al momento de uso."""
        self.unit_cost_at_time = cost


class MaintenanceOrder(BaseEntity):
    machine_id: UUID
    description: str
    status: MaintenanceStatus = MaintenanceStatus.PROGRAMADO
    assigned_mechanic_id: UUID
    next_service_horometer: float | None = None

    # Lista en memoria de repuestos requeridos
    spare_parts: list[MaintenanceSparePart] = []


    def start_execution(self) -> None:
        """Cambia el estado de la OT a EN_EJECUCION."""
        from src.features.maintenance.domain.exceptions import (
            InvalidMaintenanceTransitionException,
        )

        if self.status != MaintenanceStatus.PROGRAMADO:
            raise InvalidMaintenanceTransitionException(self.status, MaintenanceStatus.EN_EJECUCION)
        self.status = MaintenanceStatus.EN_EJECUCION

    def add_spare_part(self, spare_part_id: UUID, quantity: int) -> MaintenanceSparePart:
        """Agrega un repuesto requerido a la orden de trabajo en memoria."""
        from src.features.maintenance.domain.exceptions import (
            InvalidMaintenanceOperationException,
        )

        if self.status != MaintenanceStatus.EN_EJECUCION:
            raise InvalidMaintenanceOperationException(
                "Solo se pueden registrar repuestos mientras la orden de trabajo esté EN_EJECUCION."
            )

        req = MaintenanceSparePart(
            maintenance_order_id=self.id,
            spare_part_id=spare_part_id,
            quantity_requested=quantity,
        )
        self.spare_parts.append(req)
        return req

    def liquidate(self, current_horometer: float) -> None:
        """Valida y liquida la orden de trabajo calculando el próximo mantenimiento."""
        from src.features.maintenance.domain.exceptions import (
            InvalidMaintenanceTransitionException,
        )

        if self.status != MaintenanceStatus.EN_EJECUCION:
            raise InvalidMaintenanceTransitionException(self.status, MaintenanceStatus.LIQUIDADO)

        # Próximo servicio = horómetro actual de la máquina + 250 horas
        self.next_service_horometer = current_horometer + 250.0
        self.status = MaintenanceStatus.LIQUIDADO
