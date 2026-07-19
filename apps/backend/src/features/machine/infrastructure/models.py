from sqlalchemy import Column, Float, Integer, String, Text
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class MachineModel(BaseModel):
    __tablename__ = "machines"

    code = Column(String(50), unique=True, nullable=False, index=True)
    motor_serial = Column(String(100), unique=True, nullable=False, index=True)
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    manufacture_year = Column(Integer, nullable=False)
    current_horometer = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="ACTIVA")
    horometer_unit = Column(String(20), nullable=False, default="Horas")
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
