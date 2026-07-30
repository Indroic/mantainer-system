from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.maintenance.domain.entities import (
    MaintenanceOrder,
    MaintenanceSparePart,
)
from src.features.maintenance.domain.exceptions import MaintenanceNotFoundException
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)


class MaintenanceOrderRepository(
    SQLAlchemyCommonImplementationsRepo[MaintenanceOrder, MaintenanceOrderModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[MaintenanceOrder]:
        return MaintenanceOrder

    @property
    def model_cls(self) -> type[MaintenanceOrderModel]:
        return MaintenanceOrderModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return MaintenanceNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        async def resolve_spare_parts(
            model: MaintenanceOrderModel,
        ) -> list[MaintenanceSparePart]:
            return [
                MaintenanceSparePart(
                    id=sp.id,
                    maintenance_order_id=sp.maintenance_order_id,
                    spare_part_id=sp.spare_part_id,
                    quantity_requested=sp.quantity_requested,
                    quantity_returned=getattr(sp, "quantity_returned", 0),
                    unit_cost_at_time=sp.unit_cost_at_time,
                    created_at=sp.created_at,
                    updated_at=sp.updated_at,
                    is_active=sp.is_active,
                )
                for sp in model.spare_parts
            ]

        return {"spare_parts": ("spare_parts", resolve_spare_parts)}


    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        def serialize_spare_parts(entity: MaintenanceOrder) -> list[MaintenanceSparePartModel]:
            return [
                MaintenanceSparePartModel(
                    id=sp.id,
                    maintenance_order_id=sp.maintenance_order_id,
                    spare_part_id=sp.spare_part_id,
                    quantity_requested=sp.quantity_requested,
                    quantity_returned=sp.quantity_returned,
                    unit_cost_at_time=sp.unit_cost_at_time,
                    is_active=sp.is_active,
                )
                for sp in entity.spare_parts
            ]

        return {"spare_parts": ("spare_parts", serialize_spare_parts)}





