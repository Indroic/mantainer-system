from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.application.use_cases.query import QueryEntitiesUseCase
from src.features.machine.domain.entities import Machine


class QueryMachinesUseCase(QueryEntitiesUseCase[Machine]):
    async def execute(self, command: QueryRequestDTO) -> QueryResponseDTO:
        """Consulta, filtra, ordena y pagina la maquinaria registrada."""
        return await super().execute(command)
