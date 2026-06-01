from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.user.application.dtos import UserMetadataResponse
from src.features.user.domain.exceptions import UserMetadataNotFoundException
from src.features.user.domain.services import UserMetadataDomainService


class GetUserMetadataByBetterAuthIdUseCase(UseCase[str, UserMetadataResponse]):
    def __init__(self, service: UserMetadataDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(self, better_auth_user_id: str) -> UserMetadataResponse:
        # Consulta de solo lectura. No modificamos datos, por lo que no es estrictamente
        # necesario uow.commit(), pero podemos usar el uow context si es necesario.
        async with self.uow:
            metadata = await self.service.get_by_better_auth_id(better_auth_user_id)

        if not metadata:
            raise UserMetadataNotFoundException(better_auth_user_id)

        return UserMetadataResponse(
            id=metadata.id,
            better_auth_user_id=metadata.better_auth_user_id,
            role=metadata.role,
            hourly_rate=metadata.hourly_rate,
            created_at=metadata.created_at,
            updated_at=metadata.updated_at,
            is_active=metadata.is_active,
        )
