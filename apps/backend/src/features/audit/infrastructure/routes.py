from datetime import datetime, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from sqlalchemy import func, select
from src.features.auth.dependencies import PLANNER_ONLY, require_roles
from src.features.audit.application.dtos import (
    AuditFacetItem,
    AuditLogFacetsResponse,
    AuditLogResponse,
)
from src.features.audit.application.use_cases.query_audit_logs import (
    QueryAuditLogsUseCase,
)
from src.features.audit.infrastructure.models import AuditLogModel
from src.features.audit.infrastructure.repositories import AuditLogRepository
from src.shared.infrastructure.database.db import get_uow
from src.shared.infrastructure.database.user_lookup import resolve_user_names

router = APIRouter(prefix="/audit-logs", tags=["Forensic Audit Logs"])

#: Campos de TEXTO sobre los que actúa la búsqueda libre de la bitácora.
#
# `entity_id` queda deliberadamente fuera: es una columna UUID y su
# representación textual depende del motor (PostgreSQL la expone con guiones,
# SQLite la guarda como hexadecimal sin guiones), así que un `LIKE` sobre ella
# encontraría el registro en producción y no en las pruebas. Buscar por
# identificador se resuelve con una igualdad exacta en `_uuid_or_none`.
_SEARCH_FIELDS = ["entity_name", "action", "payload", "performed_by"]


def _uuid_or_none(raw: str) -> UUID | None:
    """Devuelve el UUID si el texto lo es; ``None`` en caso contrario."""
    try:
        return UUID(raw)
    except (ValueError, AttributeError, TypeError):
        return None


def _parse_day_boundary(raw: str | None, *, end_of_day: bool) -> datetime | None:
    """Interpreta una fecha ``YYYY-MM-DD`` (o ISO completa) del filtro temporal.

    El límite superior se lleva al final del día: si no, filtrar "hasta el 12"
    excluiría todo lo ocurrido ese mismo 12, que es justo lo que el auditor
    espera ver.
    """
    token = (raw or "").strip()
    if not token:
        return None
    try:
        parsed = datetime.fromisoformat(token.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Fecha inválida: '{raw}'. Use el formato AAAA-MM-DD.",
        ) from exc

    # Una fecha sin hora define el día completo.
    if len(token) == 10:
        return datetime.combine(parsed.date(), time.max if end_of_day else time.min)
    return parsed


def _build_audit_log_response(item, performed_by_name: str | None) -> AuditLogResponse:
    import json

    return AuditLogResponse(
        id=item.id,
        entity_name=item.entity_name,
        entity_id=item.entity_id,
        action=item.action,
        payload=json.dumps(item.payload) if isinstance(item.payload, dict) else str(item.payload),
        performed_by=item.performed_by,
        performed_by_name=performed_by_name,
        created_at=item.created_at,
        is_active=item.is_active,
    )


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[Depends(require_roles(PLANNER_ONLY))],
)
async def query_audit_logs(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina la bitácora forense de auditoría.

    Restringido al rol Administrador.
    """
    repo = AuditLogRepository(uow)
    use_case = QueryAuditLogsUseCase(repo)
    return await use_case.execute(query)


@router.get(
    "/facets",
    response_model=AuditLogFacetsResponse,
    dependencies=[Depends(require_roles(PLANNER_ONLY))],
)
async def get_audit_log_facets(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> AuditLogFacetsResponse:
    """Valores de entidad y operación realmente presentes en la bitácora.

    La UI construye sus desplegables con esto, de modo que un filtro siempre
    corresponde a datos existentes. Antes las opciones estaban escritas a mano
    (`CREATE` / `UPDATE` / `DELETE`) y no coincidían con lo que se graba
    (`SOFT_DELETE`, `UPDATE_STOCK`, `LIQUIDATE`…), por lo que la mayoría de los
    filtros no devolvía ningún registro.
    """

    async def _facets(column) -> list[AuditFacetItem]:
        stmt = (
            select(column, func.count().label("total"))
            .group_by(column)
            .order_by(func.count().desc())
        )
        rows = await uow.session.execute(stmt)
        return [
            AuditFacetItem(value=str(value), count=int(total or 0))
            for value, total in rows.all()
            if value is not None and str(value).strip() != ""
        ]

    entity_names = await _facets(AuditLogModel.entity_name)
    actions = await _facets(AuditLogModel.action)
    total = int(
        (await uow.session.execute(select(func.count()).select_from(AuditLogModel)))
        .scalar_one()
        or 0
    )

    return AuditLogFacetsResponse(
        entity_names=entity_names, actions=actions, total=total
    )


@router.get(
    "/",
    response_model=list[AuditLogResponse],
    dependencies=[Depends(require_roles(PLANNER_ONLY))],
)
async def get_audit_logs(
    entity_name: str | None = None,
    action: str | None = None,
    performed_by: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 1000,
    offset: int = 0,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[AuditLogResponse]:
    """Obtiene la bitácora forense, con filtros de entidad, operación, autor,
    rango de fechas y búsqueda libre.

    Los valores admitidos por `entity_name` y `action` son los que devuelve
    `GET /audit-logs/facets`.
    """
    from hexcore.application.dtos.query import FilterConditionDTO, FilterOperator

    filters = []
    # Se normaliza el valor y se descarta el centinela "ALL" que envía la UI para
    # "sin filtro": tratarlo como valor literal no devolvería ningún registro.
    def _clean(raw: str | None) -> str | None:
        token = (raw or "").strip()
        return None if not token or token.upper() == "ALL" else token

    if entity := _clean(entity_name):
        filters.append(
            FilterConditionDTO(
                field="entity_name", operator=FilterOperator.EQ, value=entity
            )
        )
    if operation := _clean(action):
        filters.append(
            FilterConditionDTO(field="action", operator=FilterOperator.EQ, value=operation)
        )
    if author := _clean(performed_by):
        filters.append(
            FilterConditionDTO(
                field="performed_by", operator=FilterOperator.EQ, value=author
            )
        )

    if start := _parse_day_boundary(date_from, end_of_day=False):
        filters.append(
            FilterConditionDTO(
                field="created_at", operator=FilterOperator.GTE, value=start
            )
        )
    if end := _parse_day_boundary(date_to, end_of_day=True):
        filters.append(
            FilterConditionDTO(
                field="created_at", operator=FilterOperator.LTE, value=end
            )
        )

    # La búsqueda libre admite además un identificador: si el término es un UUID
    # se busca el registro concreto por igualdad, que es como se rastrea un
    # incidente a partir del ID que aparece en la tabla.
    search_text = _clean(search)
    if search_text and (target_id := _uuid_or_none(search_text)) is not None:
        filters.append(
            FilterConditionDTO(
                field="entity_id", operator=FilterOperator.EQ, value=target_id
            )
        )
        search_text = None

    query_dto = QueryRequestDTO(
        limit=max(1, min(limit, 5000)),
        offset=max(0, offset),
        filters=filters,
        search=search_text,
        search_fields=_SEARCH_FIELDS if search_text else [],
    )
    repo = AuditLogRepository(uow)
    use_case = QueryAuditLogsUseCase(repo)
    result = await use_case.execute(query_dto)

    performed_by_ids = {item.performed_by for item in result.items}
    names = await resolve_user_names(uow.session, performed_by_ids)

    items = [
        _build_audit_log_response(item, names.get(item.performed_by))
        for item in result.items
    ]
    # La bitácora se lee de lo más reciente a lo más antiguo: es el orden en que
    # se investiga un incidente.
    items.sort(key=lambda entry: entry.created_at, reverse=True)
    return items


