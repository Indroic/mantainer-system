from uuid import UUID


class NotificationNotFoundException(Exception):
    """La notificación solicitada no existe."""

    def __init__(self, notification_id: UUID | str) -> None:
        super().__init__(f"No se encontró la notificación con ID '{notification_id}'.")


class NotificationForbiddenException(Exception):
    """Un usuario intentó operar sobre una notificación que no es suya."""

    def __init__(self, notification_id: UUID | str) -> None:
        super().__init__(
            f"La notificación '{notification_id}' no pertenece al usuario autenticado."
        )
