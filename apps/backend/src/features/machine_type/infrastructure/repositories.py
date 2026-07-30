from sqlalchemy import select
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.infrastructure.repositories.utils import to_entity_from_model_or_document
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.machine_type.domain.entities import MachineType
from src.features.machine_type.domain.exceptions import MachineTypeNotFoundException
from src.features.machine_type.infrastructure.models import MachineTypeModel


class MachineTypeRepository(
    SQLAlchemyCommonImplementationsRepo[MachineType, MachineTypeModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[MachineType]:
        return MachineType

    @property
    def model_cls(self) -> type[MachineTypeModel]:
        return MachineTypeModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return MachineTypeNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None

    async def get_by_name(self, name: str) -> MachineType | None:
        stmt = select(self.model_cls).where(self.model_cls.name == name)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            return await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
        return None
