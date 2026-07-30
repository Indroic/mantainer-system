from uuid import UUID

from sqlalchemy import desc, func, select
from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.infrastructure.repositories.utils import to_entity_from_model_or_document
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.solvency.domain.entities import (
    SolvencyItem,
    SparePartSolvency,
)
from src.features.solvency.domain.exceptions import SolvencyNotFoundException
from src.features.solvency.infrastructure.models import (
    SolvencyItemModel,
    SparePartSolvencyModel,
)


class SolvencyRepository(
    SQLAlchemyCommonImplementationsRepo[SparePartSolvency, SparePartSolvencyModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[SparePartSolvency]:
        return SparePartSolvency

    @property
    def model_cls(self) -> type[SparePartSolvencyModel]:
        return SparePartSolvencyModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return SolvencyNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        async def resolve_items(model: SparePartSolvencyModel) -> list[SolvencyItem]:
            return [
                SolvencyItem(
                    id=item.id,
                    solvency_id=item.solvency_id,
                    spare_part_id=item.spare_part_id,
                    spare_part_code=item.spare_part_code,
                    spare_part_name=item.spare_part_name,
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    is_active=item.is_active,
                )
                for item in model.items
            ]

        return {"items": ("items", resolve_items)}

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        def serialize_items(entity: SparePartSolvency) -> list[SolvencyItemModel]:
            return [
                SolvencyItemModel(
                    id=item.id,
                    solvency_id=item.solvency_id,
                    spare_part_id=item.spare_part_id,
                    spare_part_code=item.spare_part_code,
                    spare_part_name=item.spare_part_name,
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    is_active=item.is_active,
                )
                for item in entity.items
            ]

        return {"items": ("items", serialize_items)}

    # ------------------------------------------------------------------
    # Numeración interna secuencial
    # ------------------------------------------------------------------
    async def next_sequence_for_year(self, year: int) -> int:
        """Siguiente número de folio dentro del año indicado.

        Se calcula a partir del máximo folio ya emitido con el prefijo del año
        (no a partir del total de filas) para que una anulación o un borrado no
        provoque la reutilización de un folio.
        """
        prefix = f"SOLV-{year}-"
        stmt = select(func.max(self.model_cls.code)).where(
            self.model_cls.code.like(f"{prefix}%")
        )
        result = await self.session.execute(stmt)
        last_code = result.scalar_one_or_none()
        if not last_code:
            return 1
        try:
            return int(str(last_code).rsplit("-", 1)[1]) + 1
        except (IndexError, ValueError):
            # Folio con formato inesperado: caemos a un conteo defensivo.
            count_stmt = select(func.count()).select_from(self.model_cls).where(
                self.model_cls.code.like(f"{prefix}%")
            )
            count_result = await self.session.execute(count_stmt)
            return int(count_result.scalar_one_or_none() or 0) + 1

    async def exists_code(self, code: str) -> bool:
        stmt = select(self.model_cls.id).where(self.model_cls.code == code).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------
    async def list_by_order(self, maintenance_order_id: UUID) -> list[SparePartSolvency]:
        """Solvencias emitidas para una OT, más recientes primero."""
        stmt = (
            select(self.model_cls)
            .where(
                self.model_cls.maintenance_order_id == maintenance_order_id,
                self.model_cls.is_active == True,  # noqa: E712
            )
            .order_by(desc(self.model_cls.created_at))
        )
        return await self._to_entities(stmt)

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        machine_id: UUID | None = None,
        limit: int = 500,
    ) -> list[SparePartSolvency]:
        """Bandeja de despacho de Almacén, opcionalmente filtrada."""
        stmt = select(self.model_cls).where(
            self.model_cls.is_active == True  # noqa: E712
        )
        if status:
            stmt = stmt.where(self.model_cls.status == status)
        if machine_id:
            stmt = stmt.where(self.model_cls.machine_id == machine_id)
        stmt = stmt.order_by(desc(self.model_cls.created_at)).limit(limit)
        return await self._to_entities(stmt)

    async def _to_entities(self, stmt) -> list[SparePartSolvency]:
        result = await self.session.execute(stmt)
        return [
            await to_entity_from_model_or_document(
                model, self.entity_cls, self.fields_resolvers
            )
            for model in result.scalars().unique().all()
        ]
