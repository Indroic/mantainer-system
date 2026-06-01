from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
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
