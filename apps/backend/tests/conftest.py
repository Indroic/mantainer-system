import asyncio
import os
from collections.abc import AsyncGenerator

# DATABASE_URL es obligatorio en config.py. Durante las pruebas no usamos una
# base de datos externa (cada test crea un engine SQLite en memoria), así que
# definimos un valor por defecto antes de importar cualquier módulo que cargue
# la configuración del proyecto.
os.environ.setdefault("DATABASE_URL", "sqlite:///./sgmm.db")

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from hexcore.infrastructure.repositories.orms.sqlalchemy import BaseModel
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork

# Importamos todos los modelos para registrarlos antes de crear tablas en memoria
from src.features.user.infrastructure.models import UserMetadataModel
from src.features.machine.infrastructure.models import MachineModel
from src.features.inventory.infrastructure.models import SparePartModel
from src.features.maintenance.infrastructure.models import (
    MaintenanceOrderModel,
    MaintenanceSparePartModel,
)
from src.features.alerts.infrastructure.models import AlertModel
from src.features.audit.infrastructure.models import AuditLogModel
from src.shared.infrastructure.database.better_auth_tables import better_auth_metadata


@pytest.fixture(scope="session")
def event_loop():
    """Crea una instancia del bucle de eventos para toda la sesión de pruebas."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Fixture que crea un engine SQLite en memoria asíncrono para cada prueba."""
    # SQLite en memoria requiere mantener viva la conexión, por lo que usamos StaticPool o NullPool
    # Pero para pruebas sencillas, "sqlite+aiosqlite:///:memory:" en un engine persistente es excelente.
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Creamos todas las tablas
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
        await conn.run_sync(better_auth_metadata.create_all)

    yield engine

    # Destruimos las tablas
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(better_auth_metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_session_factory(test_engine):
    """Crea una fábrica de sesiones asíncronas para las pruebas."""
    return async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="function")
async def test_uow(test_session_factory) -> AsyncGenerator[SqlAlchemyUnitOfWork, None]:
    """Provee un Unit of Work que utiliza la base de datos de prueba en memoria."""
    async with test_session_factory() as session:
        yield SqlAlchemyUnitOfWork(session=session)
