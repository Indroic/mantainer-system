from uuid import UUID
from sqlalchemy import select, desc
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.alerts.domain.entities import Alert
from src.features.alerts.domain.exceptions import AlertNotFoundException
from src.features.alerts.infrastructure.models import AlertModel
from src.features.maintenance.infrastructure.models import MaintenanceOrderModel


class AlertRepository(SQLAlchemyCommonImplementationsRepo[Alert, AlertModel]):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[Alert]:
        return Alert

    @property
    def model_cls(self) -> type[AlertModel]:
        return AlertModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return AlertNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None

    async def get_active_alert_by_spare_part(self, spare_part_id: UUID) -> Alert | None:
        """Obtiene la alerta activa de un repuesto."""
        stmt = select(self.model_cls).where(
            self.model_cls.spare_part_id == str(spare_part_id),
            self.model_cls.is_resolved == False,
            self.model_cls.is_active == True,
        )
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            return self.to_entity(model)
        return None

    async def get_active_alert_by_machine(self, machine_id: UUID) -> Alert | None:
        """Obtiene la alerta activa de una máquina."""
        stmt = select(self.model_cls).where(
            self.model_cls.machine_id == str(machine_id),
            self.model_cls.is_resolved == False,
            self.model_cls.is_active == True,
        )
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            return self.to_entity(model)
        return None

    async def get_next_service_horometer(self, machine_id: UUID) -> float | None:
        """Busca el valor del próximo mantenimiento de la OT liquidada más reciente."""
        stmt = (
            select(MaintenanceOrderModel.next_service_horometer)
            .where(
                MaintenanceOrderModel.machine_id == str(machine_id),
                MaintenanceOrderModel.status == "LIQUIDADO",
                MaintenanceOrderModel.is_active == True,
            )
        )
        stmt = stmt.order_by(desc(MaintenanceOrderModel.created_at)).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

