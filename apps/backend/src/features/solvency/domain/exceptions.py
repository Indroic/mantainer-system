from uuid import UUID


class SolvencyNotFoundException(Exception):
    """La Solvencia de Repuestos solicitada no existe."""

    def __init__(self, solvency_id: UUID | str) -> None:
        super().__init__(
            f"No se encontró la Solvencia de Repuestos con ID '{solvency_id}'."
        )


class InvalidSolvencyTransitionException(Exception):
    """Transición de estado no permitida para el documento de Solvencia."""

    def __init__(self, current: str, target: str) -> None:
        super().__init__(
            f"No se puede pasar la Solvencia de '{current}' a '{target}'."
        )
