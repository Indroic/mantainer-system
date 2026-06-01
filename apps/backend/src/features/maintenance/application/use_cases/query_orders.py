from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.application.use_cases.query import QueryEntitiesUseCase
from src.features.maintenance.domain.entities import MaintenanceOrder


class QueryMaintenanceOrdersUseCase(QueryEntitiesUseCase[MaintenanceOrder]):
    async def execute(self, command: QueryRequestDTO) -> QueryResponseDTO:
        """Consulta, filtra y pagina las órdenes de trabajo registradas."""
        return await super().execute(command)
