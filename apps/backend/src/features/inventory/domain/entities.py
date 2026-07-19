from typing import Self
from pydantic import model_validator
from hexcore.domain.base import BaseEntity


class SparePart(BaseEntity):
    code: str
    name: str
    stock_current: int = 0
    stock_minimum: int
    unit_cost: float
    # Campos extendidos
    part_number: str | None = None
    unit_of_measure: str | None = None
    internal_code: str | None = None
    unit_cost_usd: float | None = None

    @model_validator(mode="after")
    def validate_stock(self) -> Self:
        from src.features.inventory.domain.exceptions import SparePartNegativeStockException
        if self.stock_current < 0:
            raise SparePartNegativeStockException(self.code, self.stock_current)
        return self



    def update_stock(self, new_stock: int) -> None:
        """Actualiza el stock actual de la pieza y valida que no sea negativo."""
        from src.features.inventory.domain.exceptions import SparePartNegativeStockException

        if new_stock < 0:
            raise SparePartNegativeStockException(self.code, new_stock)
        self.stock_current = new_stock

    def decrease_stock(self, quantity: int) -> None:
        """Disminuye el stock físico y valida que no quede en negativo."""
        from src.features.inventory.domain.exceptions import SparePartNegativeStockException

        if self.stock_current - quantity < 0:
            raise SparePartNegativeStockException(self.code, self.stock_current - quantity)
        self.stock_current -= quantity

    def increase_stock(self, quantity: int) -> None:
        """Incrementa el stock físico."""
        self.stock_current += quantity

    def soft_delete(self) -> None:
        """Aplica la baja lógica."""
        self.is_active = False
