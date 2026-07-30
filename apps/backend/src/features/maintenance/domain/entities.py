from enum import Enum
from uuid import UUID
from hexcore.domain.base import BaseEntity


class MaintenanceStatus(str, Enum):
    PROGRAMADO = "PROGRAMADO"
    EN_EJECUCION = "EN_EJECUCION"
    LIQUIDADO = "LIQUIDADO"


class FailureCategory(str, Enum):
    """Clasificación de la falla que motiva la OT (spec 4.1).

    Permite segmentar y filtrar la analítica de averías por sistema del activo.
    """

    SISTEMA_INYECCION = "SISTEMA_INYECCION"
    TRANSMISION = "TRANSMISION"
    MOTOR = "MOTOR"
    SISTEMA_ELECTRICO = "SISTEMA_ELECTRICO"
    SISTEMA_HIDRAULICO = "SISTEMA_HIDRAULICO"
    FRENOS = "FRENOS"
    NEUMATICOS = "NEUMATICOS"
    CHASIS_ESTRUCTURA = "CHASIS_ESTRUCTURA"
    MANTENIMIENTO_PREVENTIVO = "MANTENIMIENTO_PREVENTIVO"
    OTROS = "OTROS"


#: Etiquetas legibles para reportes, exportaciones y selectores de la UI.
FAILURE_CATEGORY_LABELS: dict[FailureCategory, str] = {
    FailureCategory.SISTEMA_INYECCION: "Sistema de Inyección",
    FailureCategory.TRANSMISION: "Transmisión",
    FailureCategory.MOTOR: "Motor",
    FailureCategory.SISTEMA_ELECTRICO: "Sistema Eléctrico",
    FailureCategory.SISTEMA_HIDRAULICO: "Sistema Hidráulico",
    FailureCategory.FRENOS: "Frenos",
    FailureCategory.NEUMATICOS: "Neumáticos",
    FailureCategory.CHASIS_ESTRUCTURA: "Chasis / Estructura",
    FailureCategory.MANTENIMIENTO_PREVENTIVO: "Mantenimiento Preventivo",
    FailureCategory.OTROS: "Otros",
}


def failure_category_label(category: "FailureCategory | str | None") -> str:
    """Etiqueta legible de una categoría de falla, tolerante a valores nulos."""
    if category is None:
        return "Sin clasificar"
    try:
        return FAILURE_CATEGORY_LABELS[FailureCategory(category)]
    except (KeyError, ValueError):
        return str(category)


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
    failure_category: FailureCategory | None = None
    #: Descripción detallada del trabajo realizado, capturada al liquidar (spec 5.1).
    #: Queda en el historial técnico del activo.
    work_performed: str | None = None
    #: ID de Better Auth de quien creó la OT (Supervisor o Mecánico), para poder
    #: notificarle cuando el Planificador asigne los repuestos (spec 3.3).
    created_by: str | None = None

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
        """Agrega un repuesto requerido a la orden de trabajo en memoria.

        Se permite tanto en PROGRAMADO como en EN_EJECUCION: el flujo de la spec
        2.2 es que el Supervisor/Mecánico cree la OT indicando qué necesita y el
        Planificador la revise y asigne los repuestos ANTES de que el trabajo
        arranque. Una OT ya liquidada, en cambio, es inmutable.
        """
        from src.features.maintenance.domain.exceptions import (
            InvalidMaintenanceOperationException,
        )

        if self.status == MaintenanceStatus.LIQUIDADO:
            raise InvalidMaintenanceOperationException(
                "No se pueden asignar repuestos a una orden de trabajo ya liquidada."
            )

        if quantity <= 0:
            raise InvalidMaintenanceOperationException(
                "La cantidad de repuesto asignada debe ser mayor que cero."
            )

        req = MaintenanceSparePart(
            maintenance_order_id=self.id,
            spare_part_id=spare_part_id,
            quantity_requested=quantity,
        )
        self.spare_parts.append(req)
        return req

    def classify_failure(self, category: FailureCategory | None) -> None:
        """Asigna o actualiza la categoría de falla de la orden."""
        self.failure_category = category

    def liquidate(self, current_horometer: float, work_performed: str | None = None) -> None:
        """Valida y liquida la orden de trabajo calculando el próximo mantenimiento.

        ``work_performed`` es la descripción detallada del trabajo ejecutado que
        el técnico introduce antes de cerrar la OT (spec 5.1).
        """
        from src.features.maintenance.domain.exceptions import (
            InvalidMaintenanceTransitionException,
        )

        if self.status != MaintenanceStatus.EN_EJECUCION:
            raise InvalidMaintenanceTransitionException(self.status, MaintenanceStatus.LIQUIDADO)

        if work_performed is not None:
            cleaned = work_performed.strip()
            if cleaned:
                self.work_performed = cleaned

        # Próximo servicio = horómetro actual de la máquina + 250 horas
        self.next_service_horometer = current_horometer + 250.0
        self.status = MaintenanceStatus.LIQUIDADO
