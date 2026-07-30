from sqlalchemy import Boolean, Column, Float, ForeignKey, String, Text, Uuid
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class AlertModel(BaseModel):
    __tablename__ = "alerts"

    machine_id = Column(Uuid, nullable=True)
    spare_part_id = Column(Uuid, nullable=True)
    # Plan preventivo que originó la alerta (spec 5.2). Sin FK para que borrar un
    # plan no elimine el histórico de alertas que generó.
    maintenance_plan_id = Column(Uuid, nullable=True, index=True)
    type = Column(String(50), nullable=False)
    message = Column(String(255), nullable=False)
    is_resolved = Column(Boolean, nullable=False, default=False)


class MaintenancePlanModel(BaseModel):
    """Alertas programadas por componente/uso o tiempo (spec 5.2)."""

    __tablename__ = "maintenance_plans"

    machine_id = Column(
        Uuid, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    spare_part_id = Column(Uuid, nullable=True, index=True)
    component_name = Column(String(150), nullable=False)
    basis = Column(String(20), nullable=False, default="USO")
    interval_value = Column(Float, nullable=False)
    last_service_value = Column(Float, nullable=False, default=0.0)
    warning_threshold = Column(Float, nullable=False, default=50.0)
    notes = Column(Text, nullable=True)
