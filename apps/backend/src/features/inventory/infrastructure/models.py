from sqlalchemy import Column, Float, Integer, String
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class SparePartModel(BaseModel):
    __tablename__ = "spare_parts"

    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    stock_current = Column(Integer, nullable=False, default=0)
    stock_minimum = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Float, nullable=False)
    # Campos extendidos
    part_number = Column(String(100), nullable=True, index=True)
    unit_of_measure = Column(String(50), nullable=True)
    internal_code = Column(String(100), nullable=True, unique=True, index=True)
    unit_cost_usd = Column(Float, nullable=True)
