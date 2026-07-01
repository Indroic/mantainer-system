import pytest
from sqlalchemy import insert
from src.features.audit.infrastructure.routes import _build_audit_log_response
from src.shared.infrastructure.database.better_auth_tables import user_table
from src.shared.infrastructure.database.user_lookup import resolve_user_names


class _FakeAuditItem:
    def __init__(self, id, entity_name, entity_id, action, payload, performed_by, created_at, is_active):
        self.id = id
        self.entity_name = entity_name
        self.entity_id = entity_id
        self.action = action
        self.payload = payload
        self.performed_by = performed_by
        self.created_at = created_at
        self.is_active = is_active


def test_build_audit_log_response_includes_resolved_name():
    from uuid import uuid4
    from datetime import datetime, timezone

    item = _FakeAuditItem(
        id=uuid4(),
        entity_name="Machine",
        entity_id=uuid4(),
        action="CREATE",
        payload='{"code": "CAT-320"}',
        performed_by="auth-1",
        created_at=datetime.now(timezone.utc),
        is_active=True,
    )

    response = _build_audit_log_response(item, performed_by_name="Juan Pérez")

    assert response.performed_by == "auth-1"
    assert response.performed_by_name == "Juan Pérez"
    assert response.created_at == item.created_at


def test_build_audit_log_response_falls_back_to_none_when_unresolved():
    from uuid import uuid4
    from datetime import datetime, timezone

    item = _FakeAuditItem(
        id=uuid4(),
        entity_name="Machine",
        entity_id=uuid4(),
        action="DELETE",
        payload="{}",
        performed_by="deleted-user",
        created_at=datetime.now(timezone.utc),
        is_active=True,
    )

    response = _build_audit_log_response(item, performed_by_name=None)

    assert response.performed_by == "deleted-user"
    assert response.performed_by_name is None


@pytest.mark.asyncio
async def test_resolve_user_names_used_by_audit_route_flow(test_uow):
    """Prueba de integración liviana: confirma que el flujo repo -> resolve_user_names
    -> _build_audit_log_response produce el nombre resuelto de punta a punta."""
    async with test_uow:
        await test_uow.session.execute(
            insert(user_table).values(id="auth-42", name="Ana Torres")
        )
        await test_uow.commit()

    async with test_uow:
        names = await resolve_user_names(test_uow.session, ["auth-42"])

    from uuid import uuid4
    from datetime import datetime, timezone

    item = _FakeAuditItem(
        id=uuid4(),
        entity_name="SparePart",
        entity_id=uuid4(),
        action="UPDATE",
        payload="{}",
        performed_by="auth-42",
        created_at=datetime.now(timezone.utc),
        is_active=True,
    )
    response = _build_audit_log_response(item, names.get(item.performed_by))

    assert response.performed_by_name == "Ana Torres"
