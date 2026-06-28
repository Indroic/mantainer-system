import os
from pathlib import Path
from pydantic import ConfigDict
from hexcore.config import ServerConfig
from hexcore.domain.events import IEventDispatcher
from hexcore.infrastructure.cache import ICache
from hexcore.infrastructure.cache.cache_backends.memory import MemoryCache
from hexcore.infrastructure.events.events_backends.memory import InMemoryEventDispatcher


def _require_database_url() -> str:
    """Lee el DATABASE_URL obligatorio desde el entorno.

    Es la única fuente de verdad para la conexión a la base de datos. Si la
    variable no está definida, fallamos de inmediato con un mensaje claro en
    lugar de arrancar contra una base de datos por defecto incorrecta.
    """
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError(
            "La variable de entorno DATABASE_URL es obligatoria y no está definida. "
            "Defínela con la cadena de conexión de PostgreSQL "
            "(p. ej. postgresql://usuario:clave@host:5432/basedatos)."
        )
    return database_url


def _to_sync_url(database_url: str) -> str:
    """Normaliza la URL al esquema síncrono que entiende SQLAlchemy.

    - Convierte el alias 'postgres://' (usado por algunos proveedores
      gestionados) a 'postgresql://'.
    - Si la URL trae el driver asíncrono asyncpg, lo retira para que el motor
      síncrono (Alembic) pueda usarla.
    """
    if database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url[len("postgres://"):]
    if database_url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + database_url[len("postgresql+asyncpg://"):]
    return database_url


def _to_async_url(sync_url: str) -> str:
    """Construye la URL asíncrona a partir de la URL síncrona.

    Fuerza el driver asyncpg para PostgreSQL y aiosqlite para SQLite, de modo
    que el motor asíncrono de SQLAlchemy pueda conectarse.
    """
    if sync_url.startswith("postgresql+"):
        _, _, rest = sync_url.partition("://")
        return "postgresql+asyncpg://" + rest
    if sync_url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + sync_url[len("postgresql://"):]
    if sync_url.startswith("sqlite://") and "+aiosqlite" not in sync_url:
        return "sqlite+aiosqlite://" + sync_url[len("sqlite://"):]
    return sync_url


_DATABASE_URL = _require_database_url()
SYNC_DATABASE_URL = _to_sync_url(_DATABASE_URL)
ASYNC_DATABASE_URL = _to_async_url(SYNC_DATABASE_URL)


class ProjectConfig(ServerConfig):
    base_dir: Path = Path(".")
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    sql_database_url: str = "postgresql://indroic:vFwLIC3G4VaLWgyLmSw3@2.24.222.241:5432/mantainer_db"
    async_sql_database_url: str = "postgresql+asyncpg://indroic:vFwLIC3G4VaLWgyLmSw3@2.24.222.241:5432/mantainer_db"
    cache_backend: ICache = MemoryCache()
    event_dispatcher: IEventDispatcher = InMemoryEventDispatcher()
    repository_discovery_paths: set[str] = {
        "src.features",
    }

    better_auth_url: str = "http://localhost:3000"
    jwks_url: str = "http://localhost:3000/api/auth/jwks"
    model_config = ConfigDict(arbitrary_types_allowed=True)



config = ProjectConfig()
