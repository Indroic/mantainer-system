from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class MaintenanceSparePartModel(BaseModel):
    __tablename__ = "maintenance_spare_parts"

    maintenance_order_id = Column(
        Uuid,
        ForeignKey("maintenance_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    spare_part_id = Column(
        Uuid,
        ForeignKey("spare_parts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity_requested = Column(Integer, nullable=False, default=1)
    unit_cost_at_time = Column(Float, nullable=True)

    order = relationship("MaintenanceOrderModel", back_populates="spare_parts")


class MaintenanceOrderModel(BaseModel):
    __tablename__ = "maintenance_orders"

    machine_id = Column(Uuid, ForeignKey("machines.id"), nullable=False)
    description = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="PROGRAMADO")
    assigned_mechanic_id = Column(
        Uuid, ForeignKey("user_metadata.id"), nullable=False
    )
    next_service_horometer = Column(Float, nullable=True)
    # Clasificación de la falla, indexada porque la analítica de averías filtra
    # y agrupa por esta columna (spec 4.1 / 4.2).
    failure_category = Column(String(50), nullable=True, index=True)
    # Descripción detallada del trabajo realizado, capturada al liquidar (spec 5.1).
    work_performed = Column(Text, nullable=True)
    # ID de Better Auth de quien registró la OT (Supervisor o Mecánico).
    created_by = Column(String(255), nullable=True)

    spare_parts = relationship(
        "MaintenanceSparePartModel",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

