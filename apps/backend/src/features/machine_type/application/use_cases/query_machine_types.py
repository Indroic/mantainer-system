from hexcore.application.use_cases.base import UseCase
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from src.features.machine_type.infrastructure.repositories import MachineTypeRepository


class QueryMachineTypesUseCase(
    UseCase[QueryRequestDTO, QueryResponseDTO]
):
    def __init__(self, repo: MachineTypeRepository) -> None:
        self.repo = repo

    async def execute(self, query: QueryRequestDTO) -> QueryResponseDTO:
        return await self.repo.query(query)
