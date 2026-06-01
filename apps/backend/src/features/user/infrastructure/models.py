from sqlalchemy import Column, Float, String
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel


class UserMetadataModel(BaseModel):
    __tablename__ = "user_metadata"

    better_auth_user_id = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False)
    hourly_rate = Column(Float, nullable=False, default=0.0)
