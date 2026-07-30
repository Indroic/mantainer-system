from enum import Enum
from uuid import UUID
from hexcore.domain.base import BaseEntity


class AlertType(str, Enum):
    MAINTENANCE_DUE = "MAINTENANCE_DUE"
    LOW_STOCK = "LOW_STOCK"
    #: Meta de uso alcanzada para un componente programado (spec 5.2), p. ej.
    #: "cambio de aceite cada 10.000 km".
    COMPONENT_SERVICE_DUE = "COMPONENT_SERVICE_DUE"


class MaintenancePlanBasis(str, Enum):
    """Criterio con el que se mide el vencimiento del servicio del componente."""

    #: Horómetro / kilometraje de la máquina (misma unidad que ``Machine.horometer_unit``).
    USO = "USO"
    #: Días naturales transcurridos desde el último servicio.
    TIEMPO = "TIEMPO"


class Alert(BaseEntity):
    machine_id: UUID | None = None
    spare_part_id: UUID | None = None
    #: Plan de mantenimiento preventivo que originó la alerta, si aplica.
    maintenance_plan_id: UUID | None = None
    type: AlertType
    message: str
    is_resolved: bool = False

    def resolve(self) -> None:
        """Marca la alerta como resuelta."""
        self.is_resolved = True


class MaintenancePlan(BaseEntity):
    """Alerta programada por componente basada en uso o tiempo (spec 5.2).

    Ejemplos: "Cambio de aceite cada 10.000 km", "Filtro de aire cada 50.000 km",
    "Revisión de frenos cada 180 días". Cuando el horómetro/kilometraje de la
    máquina alcanza o supera la meta configurada, el barrido de alertas genera
    automáticamente una alerta preventiva.
    """

    machine_id: UUID
    #: Repuesto del catálogo asociado al componente (opcional: puede ser un
    #: servicio sin pieza, p. ej. "engrase general").
    spare_part_id: UUID | None = None
    component_name: str
    basis: MaintenancePlanBasis = MaintenancePlanBasis.USO
    #: Intervalo entre servicios: unidades de uso (h/km) o días según ``basis``.
    interval_value: float
    #: Valor del horómetro en el último servicio realizado (base del cálculo).
    last_service_value: float = 0.0
    #: Margen de aviso previo: se alerta cuando falta este remanente para la meta.
    warning_threshold: float = 50.0
    notes: str | None = None

    def _validate(self) -> None:
        from src.features.alerts.domain.exceptions import InvalidMaintenancePlanException

        if self.interval_value <= 0:
            raise InvalidMaintenancePlanException(
                "El intervalo del plan de mantenimiento debe ser mayor que cero."
            )
        if self.warning_threshold < 0:
            raise InvalidMaintenancePlanException(
                "El margen de aviso previo no puede ser negativo."
            )

    @property
    def target_value(self) -> float:
        """Valor de horómetro (o días) en el que vence el próximo servicio."""
        return self.last_service_value + self.interval_value

    def remaining(self, current_value: float) -> float:
        """Uso restante hasta la meta. Negativo significa servicio vencido."""
        return self.target_value - current_value

    def is_due(self, current_value: float) -> bool:
        """``True`` cuando ya se alcanzó la meta o se está dentro del margen de aviso."""
        self._validate()
        return self.remaining(current_value) <= self.warning_threshold

    def is_overdue(self, current_value: float) -> bool:
        """``True`` cuando la meta ya se superó."""
        return self.remaining(current_value) <= 0

    def register_service(self, current_value: float) -> None:
        """Reinicia el contador tras ejecutar el servicio del componente."""
        self.last_service_value = current_value

    def update_plan(
        self,
        *,
        component_name: str | None = None,
        interval_value: float | None = None,
        last_service_value: float | None = None,
        warning_threshold: float | None = None,
        basis: MaintenancePlanBasis | None = None,
        spare_part_id: UUID | None = None,
        notes: str | None = None,
    ) -> None:
        """Actualiza la configuración del plan validando las reglas del dominio."""
        if component_name is not None:
            self.component_name = component_name
        if interval_value is not None:
            self.interval_value = interval_value
        if last_service_value is not None:
            self.last_service_value = last_service_value
        if warning_threshold is not None:
            self.warning_threshold = warning_threshold
        if basis is not None:
            self.basis = basis
        if spare_part_id is not None:
            self.spare_part_id = spare_part_id
        if notes is not None:
            self.notes = notes
        self._validate()
