class SparePartNotFoundException(Exception):
    def __init__(self, spare_part_id: str) -> None:
        super().__init__(f"No se encontró el repuesto con ID '{spare_part_id}'.")


class SparePartNegativeStockException(Exception):
    def __init__(self, code: str, stock: int) -> None:
        super().__init__(
            f"Error de inventario: Se prohíbe el stock negativo para el repuesto '{code}'. "
            f"Valor de stock intentado: {stock} unidades."
        )
