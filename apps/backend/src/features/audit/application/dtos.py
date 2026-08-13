from datetime import datetime
from uuid import UUID
from hexcore.application.dtos.base import DTO


class CreateAuditLogCommand(DTO):
    entity_name: str
    entity_id: UUID
    action: str
    payload: dict
    performed_by: str


class AuditLogResponse(DTO):
    id: UUID
    entity_name: str
    entity_id: UUID
    action: str
    payload: str
    performed_by: str
    performed_by_name: str | None = None
    created_at: datetime
    is_active: bool


class AuditFacetItem(DTO):
    """Valor presente en la bitácora junto a su número de registros."""

    value: str
    count: int


class AuditLogFacetsResponse(DTO):
    """Valores realmente presentes en la bitácora, para poblar los filtros.

    Los selectores de la Bitácora Forense filtran por igualdad exacta, así que
    ofrecer opciones que la bitácora no contiene produce filtros que nunca
    devuelven nada. Este endpoint deja que la UI construya los desplegables a
    partir de los datos existentes.
    """

    entity_names: list[AuditFacetItem] = []
    actions: list[AuditFacetItem] = []
    total: int = 0
