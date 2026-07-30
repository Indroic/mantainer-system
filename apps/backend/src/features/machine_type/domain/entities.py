from hexcore.domain.base import BaseEntity


class MachineType(BaseEntity):
    name: str
    description: str | None = None

    def soft_delete(self) -> None:
        self.is_active = False
