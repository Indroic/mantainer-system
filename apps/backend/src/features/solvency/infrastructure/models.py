from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class SolvencyItemModel(BaseModel):
    __tablename__ = "solvency_items"

    solvency_id = Column(
        Uuid,
        ForeignKey("spare_part_solvencies.id", ondelete="CASCADE"),
        nullable=False,
    )
    # No hay FK a spare_parts: el documento debe seguir siendo legible aunque la
    # pieza se dé de baja del catálogo, por eso también copiamos código y nombre.
    spare_part_id = Column(Uuid, nullable=False, index=True)
    spare_part_code = Column(String(50), nullable=False)
    spare_part_name = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Float, nullable=False, default=0.0)

    solvency = relationship("SparePartSolvencyModel", back_populates="items")


class SparePartSolvencyModel(BaseModel):
    __tablename__ = "spare_part_solvencies"

    #: Numeración interna secuencial, p. ej. "SOLV-2026-0001". Único a nivel de BD
    #: para que dos emisiones concurrentes no puedan compartir el mismo folio.
    code = Column(String(30), unique=True, nullable=False, index=True)
    solvency_type = Column(String(20), nullable=False, default="ASIGNACION", index=True)
    maintenance_order_id = Column(
        Uuid,
        ForeignKey("maintenance_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    machine_id = Column(Uuid, ForeignKey("machines.id"), nullable=False, index=True)
    machine_code = Column(String(50), nullable=True)
    issued_by = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="PENDIENTE_DESPACHO", index=True)
    dispatched_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    items = relationship(
        "SolvencyItemModel",
        back_populates="solvency",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
