from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.application.use_cases.query import QueryEntitiesUseCase
from src.features.inventory.domain.entities import SparePart


class QuerySparePartsUseCase(QueryEntitiesUseCase[SparePart]):
    async def execute(self, command: QueryRequestDTO) -> QueryResponseDTO:
        """Consulta, filtra y pagina los repuestos registrados."""
        return await super().execute(command)
