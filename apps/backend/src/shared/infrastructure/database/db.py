from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from hexcore.config import LazyConfig
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork

config = LazyConfig.get_config()
engine = create_async_engine(config.async_sql_database_url, echo=config.debug)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_uow() -> AsyncGenerator[SqlAlchemyUnitOfWork, None]:
    async with async_session_factory() as session:
        yield SqlAlchemyUnitOfWork(session=session)
