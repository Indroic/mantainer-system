from sqlalchemy import select
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.infrastructure.repositories.utils import to_entity_from_model_or_document
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.machine.domain.entities import Machine
from src.features.machine.domain.exceptions import MachineNotFoundException
from src.features.machine.infrastructure.models import MachineModel


class MachineRepository(SQLAlchemyCommonImplementationsRepo[Machine, MachineModel]):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[Machine]:
        return Machine

    @property
    def model_cls(self) -> type[MachineModel]:
        return MachineModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return MachineNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None

    async def get_by_code(self, code: str) -> Machine | None:
        """Busca una máquina por su código único.

        Lo usa la importación masiva para decidir entre crear y actualizar, en
        lugar de fallar por violación de la restricción de unicidad.
        """
        stmt = select(self.model_cls).where(self.model_cls.code == code)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            return await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
        return None
