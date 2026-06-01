from fastapi import APIRouter, Depends
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
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

