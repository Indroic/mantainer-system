from sqlalchemy import Boolean, Column, String, Uuid
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class AlertModel(BaseModel):
    __tablename__ = "alerts"

    machine_id = Column(Uuid, nullable=True)
    spare_part_id = Column(Uuid, nullable=True)
    type = Column(String(50), nullable=False)
    message = Column(String(255), nullable=False)
    is_resolved = Column(Boolean, nullable=False, default=False)

