from datetime import UTC, datetime
from uuid import UUID

from hexcore.domain.services import BaseDomainService
from src.features.solvency.domain.entities import (
    SolvencyStatus,
    SparePartSolvency,
)

#: Intentos de reintento al asignar el folio secuencial ante colisiones concurrentes.
_MAX_CODE_ATTEMPTS = 5


class SolvencyDomainService(BaseDomainService):
    """Emite y despacha documentos de "Solvencia de repuestos"."""

    def __init__(self, solvency_repo, spare_part_repo, machine_repo) -> None:
        self._repo = solvency_repo
        self._spare_part_repo = spare_part_repo
        self._machine_repo = machine_repo
        super().__init__()

    async def get_by_id(self, solvency_id: UUID) -> SparePartSolvency:
        return await self._repo.get_by_id(solvency_id)

    async def generate_code(self, *, year: int | None = None) -> str:
        """Genera el folio interno secuencial con formato ``SOLV-AAAA-NNNN``.

        La unicidad definitiva la garantiza el índice único de ``code`` en la BD;
        aquí sondeamos folios libres para minimizar el conflicto entre emisiones
        simultáneas.
        """
        target_year = year or datetime.now(UTC).year
        sequence = await self._repo.next_sequence_for_year(target_year)

        for attempt in range(_MAX_CODE_ATTEMPTS):
            candidate = f"SOLV-{target_year}-{sequence + attempt:04d}"
            if not await self._repo.exists_code(candidate):
                return candidate

        # Último recurso: continuar avanzando desde el último sondeo.
        return f"SOLV-{target_year}-{sequence + _MAX_CODE_ATTEMPTS:04d}"

    async def issue_for_assignment(
        self,
        *,
        maintenance_order_id: UUID,
        machine_id: UUID,
        issued_by: str,
        items: list[tuple[UUID, int]],
        notes: str | None = None,
    ) -> SparePartSolvency:
        """Emite la Solvencia que ampara los repuestos asignados a una OT.

        ``items`` son pares ``(spare_part_id, cantidad)``. El código, nombre y
        costo de cada pieza se copian del catálogo en este momento para que el
        documento quede como registro histórico.
        """
        machine_code: str | None = None
        try:
            machine = await self._machine_repo.get_by_id(machine_id)
            machine_code = machine.code
        except Exception:
            # El documento se emite aunque no se pueda resolver el código de la
            # máquina: el ``machine_id`` ya queda registrado.
            machine_code = None

        solvency = SparePartSolvency(
            code=await self.generate_code(),
            maintenance_order_id=maintenance_order_id,
            machine_id=machine_id,
            machine_code=machine_code,
            issued_by=issued_by,
            status=SolvencyStatus.PENDIENTE_DESPACHO,
            notes=notes,
        )

        for spare_part_id, quantity in items:
            spare_part = await self._spare_part_repo.get_by_id(spare_part_id)
            solvency.add_item(
                spare_part_id=spare_part.id,
                spare_part_code=spare_part.code,
                spare_part_name=spare_part.name,
                quantity=quantity,
                unit_cost=float(
                    getattr(spare_part, "unit_cost_usd", None) or spare_part.unit_cost or 0.0
                ),
            )

        await self._repo.save(solvency)
        return solvency

    async def mark_dispatched(
        self, solvency_id: UUID, dispatched_by: str
    ) -> SparePartSolvency:
        """Almacén confirma la entrega física de las piezas del documento."""
        solvency = await self.get_by_id(solvency_id)
        solvency.mark_dispatched(dispatched_by)
        await self._repo.save(solvency)
        return solvency

    async def list_by_order(self, maintenance_order_id: UUID) -> list[SparePartSolvency]:
        return await self._repo.list_by_order(maintenance_order_id)

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        machine_id: UUID | None = None,
        limit: int = 500,
    ) -> list[SparePartSolvency]:
        return await self._repo.list_filtered(
            status=status, machine_id=machine_id, limit=limit
        )
