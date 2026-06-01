from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.inventory.domain.entities import SparePart
from src.features.inventory.domain.exceptions import SparePartNotFoundException
from src.features.inventory.infrastructure.models import SparePartModel


class SparePartRepository(
    SQLAlchemyCommonImplementationsRepo[SparePart, SparePartModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[SparePart]:
        return SparePart

    @property
    def model_cls(self) -> type[SparePartModel]:
        return SparePartModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return SparePartNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None
