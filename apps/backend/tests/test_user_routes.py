import pytest
from src.features.user.domain.entities import UserMetadata, UserRole
from src.features.user.infrastructure.repositories import UserRepository


@pytest.mark.asyncio
async def test_list_by_role_returns_only_matching_role(test_uow):
    async with test_uow:
        repo = UserRepository(test_uow)

        mechanic_1 = UserMetadata(better_auth_user_id="auth-mec-1", role=UserRole.MECANICO, hourly_rate=50.0)
        mechanic_2 = UserMetadata(better_auth_user_id="auth-mec-2", role=UserRole.MECANICO, hourly_rate=60.0)
        supervisor = UserMetadata(better_auth_user_id="auth-sup-1", role=UserRole.SUPERVISOR, hourly_rate=0.0)

        await repo.save(mechanic_1)
        await repo.save(mechanic_2)
        await repo.save(supervisor)
        await test_uow.commit()

    async with test_uow:
        repo = UserRepository(test_uow)
        mechanics = await repo.list_by_role(UserRole.MECANICO)

    ids = {m.better_auth_user_id for m in mechanics}
    assert ids == {"auth-mec-1", "auth-mec-2"}


@pytest.mark.asyncio
async def test_list_by_role_returns_empty_when_no_match(test_uow):
    async with test_uow:
        repo = UserRepository(test_uow)
        mechanics = await repo.list_by_role(UserRole.MECANICO)

    assert mechanics == []


def test_mechanics_route_declared_before_dynamic_id_route():
    """Congela el orden de declaración: /mechanics debe registrarse antes de
    /{better_auth_user_id} o FastAPI la interpretaría como un ID."""
    from src.features.user.infrastructure.routes import router

    paths_in_order = [route.path for route in router.routes]
    mechanics_index = paths_in_order.index("/user-metadata/mechanics")
    dynamic_index = paths_in_order.index("/user-metadata/{better_auth_user_id}")

    assert mechanics_index < dynamic_index
