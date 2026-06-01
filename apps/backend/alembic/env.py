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
from src.features.alerts.infrastructure.models import AlertModel
from src.features.audit.infrastructure.models import AuditLogModel

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Sobrescribimos o configuramos la URL de conexión síncrona SQLite
# para que Alembic pueda crear las migraciones sin requerir driver asíncrono
config.set_main_option("sqlalchemy.url", "sqlite:///./sgmm.db")

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# target_metadata = mymodel.Base.metadata
target_metadata = BaseModel.metadata


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
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
