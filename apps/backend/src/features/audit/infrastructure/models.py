from sqlalchemy import Column, String, Text, Uuid, event
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class AuditLogModel(BaseModel):
    __tablename__ = "audit_logs"

    entity_name = Column(String(100), nullable=False)
    entity_id = Column(Uuid, nullable=False)
    action = Column(String(50), nullable=False)
    payload = Column(Text, nullable=False)
    performed_by = Column(String(255), nullable=False)


@event.listens_for(AuditLogModel, 'before_update')
def block_audit_log_update(mapper, connection, target):
    raise PermissionError("La bitácora de auditoría es inmutable y no se permite realizar actualizaciones (UPDATE).")


@event.listens_for(AuditLogModel, 'before_delete')
def block_audit_log_delete(mapper, connection, target):
    raise PermissionError("La bitácora de auditoría es inmutable y no se permite eliminar registros (DELETE).")

