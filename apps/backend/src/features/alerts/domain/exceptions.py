class AlertNotFoundException(Exception):
    def __init__(self, alert_id: str) -> None:
        super().__init__(f"No se encontró la alerta con ID '{alert_id}'.")


class MaintenancePlanNotFoundException(Exception):
    def __init__(self, plan_id: str) -> None:
        super().__init__(
            f"No se encontró el plan de mantenimiento preventivo con ID '{plan_id}'."
        )


class InvalidMaintenancePlanException(Exception):
    """Configuración inválida de un plan de mantenimiento preventivo."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
