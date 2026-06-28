import os
from pathlib import Path
from pydantic import ConfigDict
from hexcore.config import ServerConfig
from hexcore.domain.events import IEventDispatcher
from hexcore.infrastructure.cache import ICache
from hexcore.infrastructure.cache.cache_backends.memory import MemoryCache
from hexcore.infrastructure.events.events_backends.memory import InMemoryEventDispatcher


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
