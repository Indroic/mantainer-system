class AuditLogNotFoundException(Exception):
    def __init__(self, log_id: str) -> None:
        super().__init__(f"No se encontró el registro de auditoría con ID '{log_id}'.")
