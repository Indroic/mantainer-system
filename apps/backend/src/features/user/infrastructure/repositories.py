from sqlalchemy import select
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.infrastructure.repositories.utils import to_entity_from_model_or_document
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.user.domain.entities import UserMetadata, UserRole
from src.features.user.domain.exceptions import UserMetadataNotFoundException
from src.features.user.infrastructure.models import UserMetadataModel


class UserRepository(
    SQLAlchemyCommonImplementationsRepo[UserMetadata, UserMetadataModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[UserMetadata]:
        return UserMetadata

    @property
    def model_cls(self) -> type[UserMetadataModel]:
        return UserMetadataModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return UserMetadataNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None

    async def get_by_better_auth_id(self, better_auth_user_id: str) -> UserMetadata | None:
        """Busca el metadato local del usuario de Better Auth por su ID único."""
        stmt = select(self.model_cls).where(
            self.model_cls.better_auth_user_id == better_auth_user_id
        )
        # self.session representa la AsyncSession de SQLAlchemy provista por el Unit of Work actual
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            return self.to_entity(model)
        return None

    async def list_by_role(self, role: UserRole) -> list[UserMetadata]:
        """Lista todos los metadatos de usuario que tienen el rol dado."""
        stmt = select(self.model_cls).where(self.model_cls.role == role.value)
        result = await self.session.execute(stmt)
        return [
            await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
            for model in result.scalars().all()
        ]
