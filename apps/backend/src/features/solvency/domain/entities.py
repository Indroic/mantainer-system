from enum import Enum
from uuid import UUID

from hexcore.domain.base import BaseEntity


class SolvencyStatus(str, Enum):
    """Ciclo de vida del documento de Solvencia de Repuestos."""

    #: Emitida por el Planificador; Almacén todavía no ha entregado las piezas.
    PENDIENTE_DESPACHO = "PENDIENTE_DESPACHO"
    #: Almacén confirmó la entrega física de las piezas al Mecánico.
    DESPACHADO = "DESPACHADO"
    #: Anulada (p. ej. la asignación se revirtió).
    ANULADA = "ANULADA"


class SolvencyItem(BaseEntity):
    """Línea de detalle del documento.

    El código y el nombre del repuesto se copian al emitir para que el documento
    sea un registro histórico inmutable: si la pieza se renombra o se da de baja
    en el catálogo, la Solvencia ya emitida sigue siendo legible.
    """

    solvency_id: UUID
    spare_part_id: UUID
    spare_part_code: str
    spare_part_name: str
    quantity: int
    unit_cost: float = 0.0

    @property
    def subtotal(self) -> float:
        return self.quantity * self.unit_cost


class SparePartSolvency(BaseEntity):
    """Documento de "Solvencia de repuestos" con numeración interna secuencial.

    Se genera automáticamente cuando el Planificador asigna repuestos a una OT
    (spec 3.3) y es el comprobante que Almacén usa para despachar las piezas.
    """

    code: str
    maintenance_order_id: UUID
    machine_id: UUID
    machine_code: str | None = None
    #: ID de Better Auth del Planificador que emitió el documento.
    issued_by: str
    status: SolvencyStatus = SolvencyStatus.PENDIENTE_DESPACHO
    #: ID de Better Auth de quien confirmó el despacho (Almacén).
    dispatched_by: str | None = None
    notes: str | None = None

    items: list[SolvencyItem] = []

    @property
    def total_cost(self) -> float:
        """Valor total de las piezas amparadas por la Solvencia."""
        return sum(item.subtotal for item in self.items)

    @property
    def total_units(self) -> int:
        return sum(item.quantity for item in self.items)

    def add_item(
        self,
        *,
        spare_part_id: UUID,
        spare_part_code: str,
        spare_part_name: str,
        quantity: int,
        unit_cost: float,
    ) -> SolvencyItem:
        """Agrega una línea de repuesto al documento."""
        if quantity <= 0:
            raise ValueError("La cantidad de un repuesto en la Solvencia debe ser mayor que cero.")

        item = SolvencyItem(
            solvency_id=self.id,
            spare_part_id=spare_part_id,
            spare_part_code=spare_part_code,
            spare_part_name=spare_part_name,
            quantity=quantity,
            unit_cost=unit_cost,
        )
        self.items.append(item)
        return item

    def mark_dispatched(self, dispatched_by: str) -> None:
        """Almacén confirma la entrega física de las piezas."""
        from src.features.solvency.domain.exceptions import (
            InvalidSolvencyTransitionException,
        )

        if self.status != SolvencyStatus.PENDIENTE_DESPACHO:
            raise InvalidSolvencyTransitionException(self.status, SolvencyStatus.DESPACHADO)

        self.status = SolvencyStatus.DESPACHADO
        self.dispatched_by = dispatched_by

    def annul(self) -> None:
        """Anula la solvencia (solo si aún no se despachó)."""
        from src.features.solvency.domain.exceptions import (
            InvalidSolvencyTransitionException,
        )

        if self.status == SolvencyStatus.DESPACHADO:
            raise InvalidSolvencyTransitionException(self.status, SolvencyStatus.ANULADA)
        self.status = SolvencyStatus.ANULADA
