from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.application.use_cases.query import QueryEntitiesUseCase
from src.features.machine_type.domain.entities import MachineType


class QueryMachineTypesUseCase(QueryEntitiesUseCase[MachineType]):
    async def execute(self, query: QueryRequestDTO) -> QueryResponseDTO:
        """Consulta, filtra y pagina tipos de maquinaria de manera dinámica."""
        return await super().execute(query)
