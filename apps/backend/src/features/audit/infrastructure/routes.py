from fastapi import APIRouter, Depends
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
from src.features.audit.application.dtos import AuditLogResponse
from src.features.audit.application.use_cases.query_audit_logs import (
    QueryAuditLogsUseCase,
)
from src.features.audit.infrastructure.repositories import AuditLogRepository
from src.features.user.domain.entities import UserRole
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/audit-logs", tags=["Forensic Audit Logs"])


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR]))],
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
    "/",
    response_model=list[AuditLogResponse],
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR]))],
)
async def get_audit_logs(
    entity_name: str | None = None,
    action: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[AuditLogResponse]:
    """Obtiene la lista de bitácoras forenses de auditoría, opcionalmente filtradas."""
    from hexcore.application.dtos.query import FilterConditionDTO, FilterOperator
    import json

    filters = []
    if entity_name:
        filters.append(FilterConditionDTO(field="entity_name", operator=FilterOperator.EQ, value=entity_name))
    if action:
        filters.append(FilterConditionDTO(field="action", operator=FilterOperator.EQ, value=action))

    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        filters=filters
    )
    repo = AuditLogRepository(uow)
    use_case = QueryAuditLogsUseCase(repo)
    result = await use_case.execute(query_dto)
    
    return [
        AuditLogResponse(
            id=item.id,
            entity_name=item.entity_name,
            entity_id=item.entity_id,
            action=item.action,
            payload=json.dumps(item.payload) if isinstance(item.payload, dict) else str(item.payload),
            performed_by=item.performed_by,
            created_at=item.created_at,
            is_active=item.is_active,
        )
        for item in result.items
    ]


