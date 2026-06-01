class AlertNotFoundException(Exception):
    def __init__(self, alert_id: str) -> None:
        super().__init__(f"No se encontró la alerta con ID '{alert_id}'.")
