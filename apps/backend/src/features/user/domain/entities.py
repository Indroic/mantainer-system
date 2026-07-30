import unicodedata
from enum import Enum
from hexcore.domain.base import BaseEntity


def _normalize_role_token(raw: object) -> str:
    """Normaliza un rol a MAYÚSCULAS sin acentos para compararlo de forma robusta."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", str(raw))
        if unicodedata.category(c) != "Mn"
    ).strip().upper()


class UserRole(str, Enum):
    """Roles de negocio del SGMM.

    El antiguo rol ``Administrador`` pasó a llamarse ``Planificador``. Los valores
    heredados que siguen almacenados en base de datos (``"Administrador"``,
    ``"admin"``) y los identificadores de Better Auth (``"planner"``,
    ``"warehouse"``, ``"mechanic"``) se resuelven en ``_missing_``, de modo que
    ni las filas antiguas de ``user_metadata`` ni los JWT rompen la validación.
    """

    PLANIFICADOR = "Planificador"
    SUPERVISOR = "Supervisor"
    MECANICO = "Mecánico"
    ALMACEN = "Almacén"

    @classmethod
    def _missing_(cls, value: object) -> "UserRole | None":
        token = _normalize_role_token(value)
        aliases: dict[str, UserRole] = {
            # Planificador (antes Administrador).
            "PLANIFICADOR": cls.PLANIFICADOR,
            "PLANNER": cls.PLANIFICADOR,
            "ADMINISTRADOR": cls.PLANIFICADOR,
            "ADMIN": cls.PLANIFICADOR,
            # Supervisor.
            "SUPERVISOR": cls.SUPERVISOR,
            # Mecánico.
            "MECANICO": cls.MECANICO,
            "MECHANIC": cls.MECANICO,
            # Almacén.
            "ALMACEN": cls.ALMACEN,
            "WAREHOUSE": cls.ALMACEN,
        }
        return aliases.get(token)

    @property
    def label(self) -> str:
        """Etiqueta para mostrar en la interfaz de usuario."""
        return self.value


class UserMetadata(BaseEntity):
    better_auth_user_id: str
    role: UserRole
    hourly_rate: float = 0.0

    def update_metadata(self, role: UserRole, hourly_rate: float) -> None:
        """Permite actualizar el rol o tarifa del usuario."""
        self.role = role
        self.hourly_rate = hourly_rate
