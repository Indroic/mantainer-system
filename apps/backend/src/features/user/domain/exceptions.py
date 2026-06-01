class UserMetadataNotFoundException(Exception):
    def __init__(self, better_auth_user_id: str) -> None:
        super().__init__(
            f"No se encontraron metadatos para el usuario de Better Auth '{better_auth_user_id}'."
        )


class UserMetadataAlreadyExistsException(Exception):
    def __init__(self, better_auth_user_id: str) -> None:
        super().__init__(
            f"Ya existen metadatos registrados para el usuario '{better_auth_user_id}'."
        )
