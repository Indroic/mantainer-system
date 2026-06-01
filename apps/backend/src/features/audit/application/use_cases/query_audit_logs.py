from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.application.use_cases.query import QueryEntitiesUseCase
from src.features.audit.domain.entities import AuditLog


class QueryAuditLogsUseCase(QueryEntitiesUseCase[AuditLog]):
    async def execute(self, command: QueryRequestDTO) -> QueryResponseDTO:
        """Consulta, filtra y pagina los logs de auditoría forense."""
        return await super().execute(command)
