from hexcore.domain.uow import IUnitOfWork
from hexcore.infrastructure.repositories.implementations import (
    SQLAlchemyCommonImplementationsRepo,
)
from hexcore.types import FieldResolversType, FieldSerializersType
from src.features.audit.domain.entities import AuditLog
from src.features.audit.domain.exceptions import AuditLogNotFoundException
from src.features.audit.infrastructure.models import AuditLogModel


class AuditLogRepository(
    SQLAlchemyCommonImplementationsRepo[AuditLog, AuditLogModel]
):
    def __init__(self, uow: IUnitOfWork) -> None:
        super().__init__(uow)

    @property
    def entity_cls(self) -> type[AuditLog]:
        return AuditLog

    @property
    def model_cls(self) -> type[AuditLogModel]:
        return AuditLogModel

    @property
    def not_found_exception(self) -> type[Exception]:
        return AuditLogNotFoundException

    @property
    def fields_resolvers(self) -> FieldResolversType | None:
        return None

    @property
    def fields_serializers(self) -> FieldSerializersType | None:
        return None
