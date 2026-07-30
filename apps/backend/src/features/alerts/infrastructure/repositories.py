from uuid import UUID
from sqlalchemy import select, desc
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.infrastructure.repositories.utils import to_entity_from_model_or_document
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.alerts.domain.entities import Alert, AlertType, MaintenancePlan
from src.features.alerts.domain.exceptions import (
    AlertNotFoundException,
    MaintenancePlanNotFoundException,
)
from src.features.alerts.infrastructure.models import AlertModel, MaintenancePlanModel
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
        """Alerta de BAJO STOCK activa para un repuesto.

        Se filtra por tipo a propósito: una alerta de servicio de componente
        (``COMPONENT_SERVICE_DUE``) también referencia un ``spare_part_id``, así
        que sin el filtro esta consulta devolvería varias filas y rompería el
        barrido con ``MultipleResultsFound``.
        """
        return await self._get_active_alert(
            self.model_cls.spare_part_id == spare_part_id,
            alert_type=AlertType.LOW_STOCK,
        )

    async def get_active_alert_by_machine(self, machine_id: UUID) -> Alert | None:
        """Alerta de MANTENIMIENTO PRÓXIMO activa para una máquina.

        Igual que arriba: las alertas de componente también llevan ``machine_id``,
        por lo que el tipo forma parte del criterio de búsqueda.
        """
        return await self._get_active_alert(
            self.model_cls.machine_id == machine_id,
            alert_type=AlertType.MAINTENANCE_DUE,
        )

    async def _get_active_alert(
        self, *conditions, alert_type: AlertType | None = None
    ) -> Alert | None:
        """Primera alerta activa (no resuelta) que cumpla las condiciones dadas.

        Usa ``first()`` en lugar de ``scalar_one_or_none()``: si por cualquier
        motivo existieran duplicados históricos, el barrido debe seguir
        funcionando en lugar de fallar con una excepción.
        """
        stmt = select(self.model_cls).where(
            *conditions,
            self.model_cls.is_resolved == False,  # noqa: E712
            self.model_cls.is_active == True,  # noqa: E712
        )
        if alert_type is not None:
            stmt = stmt.where(self.model_cls.type == alert_type.value)
        stmt = stmt.order_by(desc(self.model_cls.created_at)).limit(1)

        result = await self.session.execute(stmt)
        model = result.scalars().first()
        if model:
            return await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
        return None

    async def get_next_service_horometer(self, machine_id: UUID) -> float | None:
        """Busca el valor del próximo mantenimiento de la OT liquidada más reciente."""
        stmt = (
            select(MaintenanceOrderModel.next_service_horometer)
            .where(
                MaintenanceOrderModel.machine_id == machine_id,
                MaintenanceOrderModel.status == "LIQUIDADO",
                MaintenanceOrderModel.is_active == True,
            )
        )
        stmt = stmt.order_by(desc(MaintenanceOrderModel.created_at)).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_alert_by_plan(self, plan_id: UUID) -> Alert | None:
        """Alerta activa generada por un plan de mantenimiento preventivo (spec 5.2)."""
        return await self._get_active_alert(
            self.model_cls.maintenance_plan_id == plan_id
        )

    async def list_visible(
        self,
        *,
        excluded_types: list[AlertType] | None = None,
        only_unresolved: bool = True,
        limit: int = 500,
    ) -> list[Alert]:
        """Alertas del sistema, con exclusión de tipos por rol.

        ``excluded_types`` es lo que implementa la spec 3.2 a nivel de servidor:
        el Mecánico nunca recibe alertas de bajo stock.
        """
        stmt = select(self.model_cls).where(
            self.model_cls.is_active == True  # noqa: E712
        )
        if only_unresolved:
            stmt = stmt.where(self.model_cls.is_resolved == False)  # noqa: E712
        if excluded_types:
            stmt = stmt.where(
                self.model_cls.type.notin_([t.value for t in excluded_types])
            )
        stmt = stmt.order_by(desc(self.model_cls.created_at)).limit(limit)

        result = await self.session.execute(stmt)
        return [
            await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
            for model in result.scalars().all()
        ]


class MaintenancePlanRepository(
    SQLAlchemyCommonImplementationsRepo[MaintenancePlan, MaintenancePlanModel]
):
    """Persistencia de los planes de mantenimiento preventivo por componente."""

    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[MaintenancePlan]:
        return MaintenancePlan

    @property
    def model_cls(self) -> type[MaintenancePlanModel]:
        return MaintenancePlanModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return MaintenancePlanNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None

    async def list_active(self, machine_id: UUID | None = None) -> list[MaintenancePlan]:
        """Planes vigentes, opcionalmente los de una máquina concreta."""
        stmt = select(self.model_cls).where(
            self.model_cls.is_active == True  # noqa: E712
        )
        if machine_id:
            stmt = stmt.where(self.model_cls.machine_id == machine_id)
        stmt = stmt.order_by(self.model_cls.component_name.asc())

        result = await self.session.execute(stmt)
        return [
            await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
            for model in result.scalars().all()
        ]

