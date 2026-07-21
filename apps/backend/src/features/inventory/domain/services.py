from hexcore.domain.services import BaseDomainService
from src.features.inventory.domain.entities import SparePart


class InventoryDomainService(BaseDomainService):
    def __init__(self, spare_part_repo) -> None:
        self._repo = spare_part_repo
        super().__init__()

    async def get_by_id(self, spare_part_id) -> SparePart:
        """Obtiene un repuesto por su ID."""
        return await self._repo.get_by_id(spare_part_id)

    async def create_spare_part(
        self,
        code: str,
        name: str,
        stock_minimum: int,
        unit_cost: float,
        stock_current: int,
        part_number: str | None = None,
        unit_of_measure: str | None = None,
        internal_code: str | None = None,
        unit_cost_usd: float | None = None,
    ) -> SparePart:
        """Crea y registra un nuevo repuesto."""
        spare_part = SparePart(
            code=code,
            name=name,
            stock_minimum=stock_minimum,
            unit_cost=unit_cost,
            stock_current=stock_current,
            part_number=part_number,
            unit_of_measure=unit_of_measure,
            internal_code=internal_code,
            unit_cost_usd=unit_cost_usd,
        )
        await self._repo.save(spare_part)
        return spare_part

    async def update_stock(self, spare_part_id, new_stock: int) -> SparePart:
        """Valida y actualiza el stock actual de un repuesto."""
        spare_part = await self.get_by_id(spare_part_id)
        spare_part.update_stock(new_stock)
        await self._repo.save(spare_part)
        return spare_part

    async def soft_delete(self, spare_part_id) -> SparePart:
        """Aplica la baja lógica (soft delete) del repuesto."""
        spare_part = await self.get_by_id(spare_part_id)
        spare_part.soft_delete()
        await self._repo.save(spare_part)
        return spare_part
