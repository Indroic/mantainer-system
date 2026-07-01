import pytest
from sqlalchemy import insert
from src.shared.infrastructure.database.better_auth_tables import user_table
from src.shared.infrastructure.database.user_lookup import resolve_user_names


@pytest.mark.asyncio
async def test_resolve_user_names_returns_matching_names(test_uow):
    async with test_uow:
        await test_uow.session.execute(
            insert(user_table).values(id="auth-1", name="Juan Pérez")
        )
        await test_uow.session.execute(
            insert(user_table).values(id="auth-2", name="María Gómez")
        )
        await test_uow.commit()

    async with test_uow:
        result = await resolve_user_names(test_uow.session, ["auth-1", "auth-2"])

    assert result == {"auth-1": "Juan Pérez", "auth-2": "María Gómez"}


@pytest.mark.asyncio
async def test_resolve_user_names_skips_missing_ids(test_uow):
    async with test_uow:
        await test_uow.session.execute(
            insert(user_table).values(id="auth-1", name="Juan Pérez")
        )
        await test_uow.commit()

    async with test_uow:
        result = await resolve_user_names(test_uow.session, ["auth-1", "does-not-exist"])

    assert result == {"auth-1": "Juan Pérez"}


@pytest.mark.asyncio
async def test_resolve_user_names_empty_input_returns_empty_dict(test_uow):
    async with test_uow:
        result = await resolve_user_names(test_uow.session, [])

    assert result == {}
