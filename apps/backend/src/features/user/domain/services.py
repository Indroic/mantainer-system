from hexcore.domain.services import BaseDomainService
from src.features.user.domain.entities import UserMetadata, UserRole


class UserMetadataDomainService(BaseDomainService):
    def __init__(self, user_metadata_repo) -> None:
        self._repo = user_metadata_repo
        super().__init__()

    async def get_by_better_auth_id(self, better_auth_user_id: str) -> UserMetadata | None:
        """Busca metadatos de usuario por better_auth_user_id en el repositorio."""
        # Usamos el método especializado que definiremos en el repositorio
        return await self._repo.get_by_better_auth_id(better_auth_user_id)

    async def create_or_update_metadata(
        self, better_auth_user_id: str, role: UserRole, hourly_rate: float
    ) -> UserMetadata:
        """Crea o actualiza los metadatos locales de un usuario de Better Auth."""
        metadata = await self.get_by_better_auth_id(better_auth_user_id)

        if metadata:
            metadata.update_metadata(role=role, hourly_rate=hourly_rate)
        else:
            metadata = UserMetadata(
                better_auth_user_id=better_auth_user_id, role=role, hourly_rate=hourly_rate
            )

        await self._repo.save(metadata)
        return metadata
