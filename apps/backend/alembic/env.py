from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Importamos BaseModel para obtener target_metadata
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel

# Importamos todos los modelos para registrarlos en los metadatos de BaseModel
from src.features.user.infrastructure.models import UserMetadataModel
from src.features.machine.infrastructure.models import MachineModel
from src.features.inventory.infrastructure.models import SparePartModel
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)
from src.features.alerts.infrastructure.models import (
    AlertModel,
    MaintenancePlanModel,
)
from src.features.audit.infrastructure.models import AuditLogModel
from src.features.notifications.infrastructure.models import NotificationModel
from src.features.solvency.infrastructure.models import (
    SolvencyItemModel,
    SparePartSolvencyModel,
)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config


def _resolve_sync_database_url() -> str:
    """Resuelve la URL síncrona que Alembic usará para las migraciones.

    En despliegue, ProjectConfig deriva esta URL del DATABASE_URL obligatorio,
    de modo que `alembic upgrade head` aplique el esquema en la base de datos
    real (PostgreSQL). En local, sin DATABASE_URL definido, la importación de
    `config` falla y caemos a SQLite para poder autogenerar migraciones sin
    necesidad de una base de datos en ejecución.
    """
    try:
        from config import config as project_config

        return project_config.sql_database_url
    except Exception:
        return "sqlite:///./sgmm.db"


# Configuramos la URL de conexión síncrona usada por Alembic.
config.set_main_option("sqlalchemy.url", _resolve_sync_database_url())

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# target_metadata = mymodel.Base.metadata
target_metadata = BaseModel.metadata


def include_name(name, type_, parent_names):
    """Limita Alembic EXCLUSIVAMENTE a las tablas gestionadas por la API.

    La API comparte la base de datos con Better Auth (tablas user, session,
    account, verification, jwks creadas por Drizzle). Sin este filtro,
    `alembic revision --autogenerate` vería esas tablas como "sobrantes" y
    generaría DROPs sobre ellas. Reflejamos solo las tablas presentes en
    nuestro metadata para no interferir nunca con Better Auth.
    """
    if type_ == "table":
        return name in target_metadata.tables
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_name=include_name,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
