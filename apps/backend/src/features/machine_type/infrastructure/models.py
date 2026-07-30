from sqlalchemy import Column, String, Text
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class MachineTypeModel(BaseModel):
    __tablename__ = "machine_types"

    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
