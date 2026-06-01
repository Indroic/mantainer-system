from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.application.use_cases.query import QueryEntitiesUseCase
from src.features.alerts.domain.entities import Alert


class QueryAlertsUseCase(QueryEntitiesUseCase[Alert]):
    async def execute(self, command: QueryRequestDTO) -> QueryResponseDTO:
        """Consulta, filtra y pagina las alertas de manera dinámica."""
        return await super().execute(command)
