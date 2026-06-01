import json
from uuid import UUID
from pydantic import model_validator
from hexcore.domain.base import BaseEntity


class AuditLog(BaseEntity):
    entity_name: str
    entity_id: UUID
    action: str
    payload: str  # Almacenado como JSON String
    performed_by: str  # ID de Better Auth

    @model_validator(mode="before")
    @classmethod
    def serialize_payload(cls, data: dict) -> dict:
        if isinstance(data, dict) and "payload" in data:
            if isinstance(data["payload"], dict):
                data["payload"] = json.dumps(data["payload"])
        return data


