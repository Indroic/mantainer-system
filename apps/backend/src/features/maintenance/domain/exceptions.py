from src.features.maintenance.domain.entities import MaintenanceStatus


class MaintenanceNotFoundException(Exception):
    def __init__(self, order_id: str) -> None:
        super().__init__(f"No se encontró la orden de trabajo con ID '{order_id}'.")


class InvalidMaintenanceTransitionException(Exception):
    def __init__(self, current: MaintenanceStatus, target: MaintenanceStatus) -> None:
        super().__init__(
            f"Transición de estado inválida: No se puede pasar de '{current.value}' a '{target.value}'."
        )


class InvalidMaintenanceOperationException(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(f"Operación inválida en orden de trabajo: {detail}")
