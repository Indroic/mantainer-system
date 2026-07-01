# Fase 1: Bugs Críticos y UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four Fase-1 bugs (auditoría forense, selector de mecánico en OT, y validación de contraseña/nombre de usuario) confirmed by root-cause investigation, without touching Fase 2/3 scope.

**Architecture:** Backend is `apps/backend` (Python/FastAPI, HexCore hexagonal architecture, SQLAlchemy async, Postgres). Frontend is `apps/web` (TanStack Start, `@tanstack/react-form`, zod, shadcn/ui via `packages/ui`). Auth is Better-Auth (`packages/auth`), sharing the **same Postgres database** as the FastAPI backend, which lets the backend read Better-Auth's `user` table directly via a plain SQLAlchemy Core `Table` (no ORM ownership, no HTTP call).

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.x async, HexCore 2.0.6, pytest + pytest-asyncio (`asyncio_mode = "auto"`), React 19, TanStack Start/Form/Query, zod, better-auth.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-fase1-bugs-criticos-design.md` — every task below implements one section of it.
- No changes to Fase 2/3 scope (machinery/repuestos schema, SOLPED, reportes Pareto, etc).
- No frontend test runner exists in this repo (`apps/web` and `packages/auth` have no `test` script) — frontend/auth-package tasks end in manual browser verification, not automated tests. Backend (`apps/backend`) has pytest + pytest-asyncio configured (`testpaths = ["tests"]`) — backend tasks must follow TDD with real tests.
- Backend tests run against an in-memory SQLite DB (see `apps/backend/tests/conftest.py`); any new backend code that queries Postgres-only tables (e.g. Better-Auth's `user` table) must go through a plain SQLAlchemy Core `Table` object registered in that same test DB, not raw textual SQL tied to Postgres syntax.
- FastAPI route order matters: a new static path (e.g. `/user-metadata/mechanics`) must be declared **before** an existing dynamic path (`/user-metadata/{better_auth_user_id}`) in the same router, or the dynamic route will swallow it.
- Match existing code style exactly: Spanish docstrings/comments where the surrounding file already uses Spanish, `snake_case` DTO fields, existing import ordering conventions per file.

---

### Task 1: Backend — cross-schema lookup of Better-Auth user names

**Files:**
- Create: `apps/backend/src/shared/infrastructure/database/better_auth_tables.py`
- Create: `apps/backend/src/shared/infrastructure/database/user_lookup.py`
- Modify: `apps/backend/tests/conftest.py`
- Create: `apps/backend/tests/test_user_lookup.py`

**Interfaces:**
- Produces: `better_auth_metadata: sqlalchemy.MetaData` and `user_table: sqlalchemy.Table` from `src.shared.infrastructure.database.better_auth_tables`, with columns `id` (str, PK) and `name` (str, not null) — mirrors `packages/db/src/schema/auth.ts`'s `user` table.
- Produces: `async def resolve_user_names(session: AsyncSession, user_ids: Iterable[str]) -> dict[str, str]` from `src.shared.infrastructure.database.user_lookup`. Given a list of Better-Auth user IDs, returns `{id: name}` for the ones that exist; missing IDs are simply absent from the dict (caller must handle with `.get(id)`).

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/test_user_lookup.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_user_lookup.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.shared.infrastructure.database.better_auth_tables'` (or `user_lookup`).

- [ ] **Step 3: Create the Better-Auth table definition**

Create `apps/backend/src/shared/infrastructure/database/better_auth_tables.py`:

```python
from sqlalchemy import Column, MetaData, String, Table

# Definición de solo lectura de la tabla `user` que administra Better Auth
# (vía Drizzle, en packages/db/src/schema/auth.ts). Backend y Better Auth
# comparten la misma base de datos Postgres, por lo que podemos leerla
# directamente sin llamadas HTTP entre servicios. No usamos un modelo
# declarativo propio porque esta tabla no pertenece a este bounded context:
# solo la consultamos, nunca la migramos ni la escribimos desde aquí.
better_auth_metadata = MetaData()

user_table = Table(
    "user",
    better_auth_metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
)
```

- [ ] **Step 4: Create the lookup helper**

Create `apps/backend/src/shared/infrastructure/database/user_lookup.py`:

```python
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.shared.infrastructure.database.better_auth_tables import user_table


async def resolve_user_names(session: AsyncSession, user_ids: Iterable[str]) -> dict[str, str]:
    """Resuelve IDs de usuario de Better Auth a su nombre para mostrar en UI.

    IDs que no existen en la tabla `user` (p. ej. usuarios eliminados) quedan
    ausentes del diccionario devuelto; el llamador debe usar `.get(id)` y
    aplicar su propio fallback (p. ej. mostrar el ID crudo).
    """
    ids = list(set(user_ids))
    if not ids:
        return {}

    stmt = select(user_table.c.id, user_table.c.name).where(user_table.c.id.in_(ids))
    result = await session.execute(stmt)
    return {row.id: row.name for row in result.all()}
```

- [ ] **Step 5: Register the Better-Auth table in the test database**

In `apps/backend/tests/conftest.py`, add the import near the other model imports (after the `AuditLogModel` import on line 26):

```python
from src.shared.infrastructure.database.better_auth_tables import better_auth_metadata
```

Then modify the `test_engine` fixture to also create/drop this table:

```python
@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Fixture que crea un engine SQLite en memoria asíncrono para cada prueba."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
        await conn.run_sync(better_auth_metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(better_auth_metadata.drop_all)

    await engine.dispose()
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && uv run pytest tests/test_user_lookup.py -v`
Expected: 3 passed.

- [ ] **Step 7: Run the full existing suite to confirm no regressions**

Run: `cd apps/backend && uv run pytest -v`
Expected: all previously-passing tests still pass (the new table is additive).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/shared/infrastructure/database/better_auth_tables.py apps/backend/src/shared/infrastructure/database/user_lookup.py apps/backend/tests/conftest.py apps/backend/tests/test_user_lookup.py
git commit -m "feat(backend): resolver nombres de usuario de Better Auth vía lectura cross-schema"
```

---

### Task 2: Backend — audit logs return `created_at` correctly and resolved `performed_by_name`

**Files:**
- Modify: `apps/backend/src/features/audit/application/dtos.py`
- Modify: `apps/backend/src/features/audit/infrastructure/routes.py`
- Test: `apps/backend/tests/test_audit_routes.py` (new)

**Interfaces:**
- Consumes: `resolve_user_names(session, user_ids)` from Task 1.
- Produces: `AuditLogResponse` now includes `performed_by_name: str | None`. Produces `_build_audit_log_response(item, performed_by_name: str | None) -> AuditLogResponse` in `audit/infrastructure/routes.py`, used by the route and directly testable.

**Note:** while investigating this bug, a second pre-existing mismatch was found in the same response: the frontend renders `previous_state`/`new_state`, but the backend only ever returns a single `payload` field (the full entity snapshot at that action, not a before/after diff) — so the "Estado Anterior"/"Estado Posterior" panels in the audit detail modal always show "N/A". Since this is the same table being touched for the date/name fix, Task 3 also fixes this by rendering a single "Estado" panel from `payload`, matching what the API actually returns. No backend change needed for this part — `payload` was already being serialized correctly.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/test_audit_routes.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_audit_routes.py -v`
Expected: FAIL with `ImportError: cannot import name '_build_audit_log_response'`.

- [ ] **Step 3: Add `performed_by_name` to the DTO**

In `apps/backend/src/features/audit/application/dtos.py`, replace the `AuditLogResponse` class:

```python
class AuditLogResponse(DTO):
    id: UUID
    entity_name: str
    entity_id: UUID
    action: str
    payload: str
    performed_by: str
    performed_by_name: str | None = None
    created_at: datetime
    is_active: bool
```

- [ ] **Step 4: Extract the builder function and wire name resolution into the route**

In `apps/backend/src/features/audit/infrastructure/routes.py`, add the import and the builder function, and rewrite `get_audit_logs`:

```python
from src.shared.infrastructure.database.user_lookup import resolve_user_names


def _build_audit_log_response(item, performed_by_name: str | None) -> AuditLogResponse:
    return AuditLogResponse(
        id=item.id,
        entity_name=item.entity_name,
        entity_id=item.entity_id,
        action=item.action,
        payload=json.dumps(item.payload) if isinstance(item.payload, dict) else str(item.payload),
        performed_by=item.performed_by,
        performed_by_name=performed_by_name,
        created_at=item.created_at,
        is_active=item.is_active,
    )
```

Replace the body of `get_audit_logs` (the `return [...]` at the end) with:

```python
    repo = AuditLogRepository(uow)
    use_case = QueryAuditLogsUseCase(repo)
    result = await use_case.execute(query_dto)

    performed_by_ids = {item.performed_by for item in result.items}
    names = await resolve_user_names(uow.session, performed_by_ids)

    return [
        _build_audit_log_response(item, names.get(item.performed_by))
        for item in result.items
    ]
```

(Keep the existing `import json` and the filters-building code above it unchanged.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && uv run pytest tests/test_audit_routes.py -v`
Expected: 3 passed.

- [ ] **Step 6: Run the full suite**

Run: `cd apps/backend && uv run pytest -v`
Expected: all tests pass, including the pre-existing `test_audit_log_generation_on_mutation` (still checks `payload` string content, untouched).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/features/audit/application/dtos.py apps/backend/src/features/audit/infrastructure/routes.py apps/backend/tests/test_audit_routes.py
git commit -m "fix(backend): auditoria devuelve performed_by_name resuelto contra Better Auth"
```

---

### Task 3: Frontend — audit table renders the correct date, resolved name, and payload

**Files:**
- Modify: `apps/web/src/features/reportes/types.ts`
- Modify: `apps/web/src/features/reportes/components/audit-log-table.tsx`

**Interfaces:**
- Consumes: `AuditLogResponse` from Task 2 (`created_at: string`, `performed_by_name: string | null`, `payload: string`).

- [ ] **Step 1: Fix the `AuditLogResponse` type**

In `apps/web/src/features/reportes/types.ts`, replace the `AuditLogResponse` interface:

```typescript
export interface AuditLogResponse {
  id: string;
  entity_name: string;
  entity_id: string;
  action: string;
  payload: string;
  performed_by: string;
  performed_by_name: string | null;
  created_at: string;
  is_active: boolean;
}
```

- [ ] **Step 2: Fix the date rendering**

In `apps/web/src/features/reportes/components/audit-log-table.tsx`, replace both occurrences of `new Date(log.timestamp)` / `new Date(selectedLog.timestamp)`:

Line 56, inside the table row:
```tsx
                  <TableCell className="font-mono text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
```

Line 116-120, inside the detail dialog:
```tsx
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase">Fecha y Hora</p>
                              <p className="text-slate-200 font-mono">
                                {selectedLog ? new Date(selectedLog.created_at).toLocaleString() : ""}
                              </p>
                            </div>
```

- [ ] **Step 3: Fix the "Realizado por" column and detail panel to show the resolved name**

Line 74-77, table row:
```tsx
                  <TableCell className="font-medium text-slate-300 text-xs flex items-center gap-1.5 pt-4">
                    <UserIcon className="size-3.5 text-slate-500" />
                    {log.performed_by_name || log.performed_by}
                  </TableCell>
```

Line 111-114, detail dialog:
```tsx
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase">Ejecutado por</p>
                              <p className="text-slate-200">{selectedLog?.performed_by_name || selectedLog?.performed_by}</p>
                            </div>
```

- [ ] **Step 4: Fix the forensic detail panel to show the actual `payload` field**

Replace the two-column "Estado Anterior" / "Estado Posterior" block (lines 123-136) with a single "Estado del Registro" panel:

```tsx
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Estado del Registro</p>
                            <pre className="p-3.5 rounded-xl border border-slate-850 bg-slate-950/80 font-mono text-[10px] text-indigo-300 overflow-x-auto max-h-60 leading-relaxed">
                              {formatStateJSON(selectedLog?.payload || null)}
                            </pre>
                          </div>
```

- [ ] **Step 5: Manual verification**

Start the dev stack (`pnpm run dev` from repo root, or the project's documented dev flow), log in as Administrador, navigate to `/auditoria`, and confirm:
- The "Fecha y Hora" column shows a real date/time, not "Invalid Date".
- "Realizado por" shows a person's name (not a raw UUID) for logs created after Task 2's deploy. Logs created before the fix will still show the raw Better-Auth ID as fallback — this is expected, not a regression.
- Clicking "Inspeccionar" shows a single "Estado del Registro" panel with real JSON content instead of two "N/A" panels.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/reportes/types.ts apps/web/src/features/reportes/components/audit-log-table.tsx
git commit -m "fix(web): auditoria muestra fecha valida, nombre de usuario y payload real"
```

---

### Task 4: Backend — endpoint to list mechanics for the OT scheduling dropdown

**Files:**
- Modify: `apps/backend/src/features/user/infrastructure/repositories.py`
- Modify: `apps/backend/src/features/user/application/dtos.py`
- Modify: `apps/backend/src/features/user/infrastructure/routes.py`
- Test: `apps/backend/tests/test_user_routes.py` (new)

**Interfaces:**
- Consumes: `resolve_user_names(session, user_ids)` from Task 1.
- Produces: `UserRepository.list_by_role(role: UserRole) -> list[UserMetadata]`.
- Produces: `MechanicResponse(DTO): id: UUID, name: str` in `user/application/dtos.py`.
- Produces: `GET /api/user-metadata/mechanics` → `list[MechanicResponse]`, restricted to ADMINISTRADOR/SUPERVISOR. `MechanicResponse.id` is the `user_metadata.id` UUID expected by `assigned_mechanic_id` when creating a maintenance order.

- [ ] **Step 1: Write the failing test for the repository method**

Create `apps/backend/tests/test_user_routes.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && uv run pytest tests/test_user_routes.py -v`
Expected: FAIL with `AttributeError: 'UserRepository' object has no attribute 'list_by_role'`.

- [ ] **Step 3: Implement `list_by_role`**

In `apps/backend/src/features/user/infrastructure/repositories.py`, add the method after `get_by_better_auth_id`:

```python
    async def list_by_role(self, role: UserRole) -> list[UserMetadata]:
        """Lista todos los metadatos de usuario que tienen el rol dado."""
        stmt = select(self.model_cls).where(self.model_cls.role == role.value)
        result = await self.session.execute(stmt)
        return [self.to_entity(model) for model in result.scalars().all()]
```

Add the `UserRole` import at the top of the file:

```python
from src.features.user.domain.entities import UserMetadata, UserRole
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && uv run pytest tests/test_user_routes.py -v`
Expected: 2 passed.

- [ ] **Step 5: Add `MechanicResponse` DTO**

In `apps/backend/src/features/user/application/dtos.py`, add after `UserMetadataResponse`:

```python
class MechanicResponse(DTO):
    id: UUID
    name: str
```

- [ ] **Step 6: Add the route (before the dynamic `{better_auth_user_id}` route)**

In `apps/backend/src/features/user/infrastructure/routes.py`, add the import:

```python
from src.features.user.application.dtos import (
    CreateOrUpdateUserMetadataCommand,
    MechanicResponse,
    UserMetadataResponse,
)
from src.shared.infrastructure.database.user_lookup import resolve_user_names
```

Insert this route **immediately after** `create_or_update_metadata` and **before** `get_user_metadata_by_id` (route order matters — a static path must precede a dynamic one):

```python
@router.get(
    "/mechanics",
    response_model=list[MechanicResponse],
    dependencies=[
        Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR]))
    ],
)
async def list_mechanics(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[MechanicResponse]:
    """Lista los usuarios con rol Mecánico, para poblar selectores de asignación.

    Restringido a Administradores y Supervisores (mismo criterio que programar OT).
    """
    repo = UserRepository(uow)
    mechanics = await repo.list_by_role(UserRole.MECANICO)

    names = await resolve_user_names(uow.session, [m.better_auth_user_id for m in mechanics])

    return [
        MechanicResponse(id=m.id, name=names.get(m.better_auth_user_id, m.better_auth_user_id))
        for m in mechanics
    ]
```

- [ ] **Step 7: Add a route-order regression test**

Add to `apps/backend/tests/test_user_routes.py`:

```python
def test_mechanics_route_declared_before_dynamic_id_route():
    """Congela el orden de declaración: /mechanics debe registrarse antes de
    /{better_auth_user_id} o FastAPI la interpretaría como un ID."""
    from src.features.user.infrastructure.routes import router

    paths_in_order = [route.path for route in router.routes]
    mechanics_index = paths_in_order.index("/user-metadata/mechanics")
    dynamic_index = paths_in_order.index("/user-metadata/{better_auth_user_id}")

    assert mechanics_index < dynamic_index
```

- [ ] **Step 8: Run the full suite**

Run: `cd apps/backend && uv run pytest -v`
Expected: all tests pass, including the new route-order test.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/features/user/infrastructure/repositories.py apps/backend/src/features/user/application/dtos.py apps/backend/src/features/user/infrastructure/routes.py apps/backend/tests/test_user_routes.py
git commit -m "feat(backend): endpoint GET /user-metadata/mechanics para el selector de OT"
```

---

### Task 5: Frontend — mechanic dropdown, larger description field, and fixed save bug

**Files:**
- Create: `packages/ui/src/components/textarea.tsx`
- Modify: `apps/web/src/features/mantenimiento/types.ts`
- Modify: `apps/web/src/features/mantenimiento/hooks/use-maintenance.ts`
- Modify: `apps/web/src/routes/_authenticated.mantenimiento.index.tsx`

**Interfaces:**
- Consumes: `GET /user-metadata/mechanics` from Task 4.
- Produces: `Textarea` component from `@mantainer-system/ui/components/textarea`, same prop surface as a native `<textarea>` plus `className`.
- Produces: `useMechanics()` hook returning `UseQueryResult<MechanicResponse[]>`.

- [ ] **Step 1: Create the Textarea primitive**

`packages/ui` has no Textarea component yet (confirmed: only badge, button, card, checkbox, dialog, dropdown-menu, input, label, select, skeleton, sonner, table, tabs exist) and its `input.tsx` wraps a `@base-ui/react/input` primitive that has no Textarea equivalent — so this is a plain native `<textarea>` styled to match `input.tsx`.

Create `packages/ui/src/components/textarea.tsx`:

```tsx
import { cn } from "@mantainer-system/ui/lib/utils";
import * as React from "react";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-none border border-input bg-transparent px-2.5 py-1.5 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
```

- [ ] **Step 2: Add the `MechanicResponse` type and `assigned_mechanic_id` note**

In `apps/web/src/features/mantenimiento/types.ts`, add at the top (after the existing imports):

```typescript
export interface MechanicResponse {
  id: string;
  name: string;
}
```

- [ ] **Step 3: Add the `useMechanics` hook**

In `apps/web/src/features/mantenimiento/hooks/use-maintenance.ts`, add the import and hook:

```typescript
import type {
  MaintenanceOrderResponse,
  CreateMaintenanceOrderCommand,
  AddSparePartToOrderCommand,
  LiquidateOrderCommand,
  MechanicResponse,
} from "../types";
```

Add after `useOrders`:

```typescript
export function useMechanics() {
  return useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => {
      return await apiClient.get<MechanicResponse[]>("/user-metadata/mechanics");
    },
    staleTime: 60 * 1000,
  });
}
```

- [ ] **Step 4: Replace the free-text mechanic input with a dropdown, fix the default value, and enlarge the description field**

In `apps/web/src/routes/_authenticated.mantenimiento.index.tsx`:

Add the import:
```typescript
import { useMechanics } from "@/features/mantenimiento/hooks/use-maintenance";
import { Textarea } from "@mantainer-system/ui/components/textarea";
```

Update the zod schema (line 30-34):
```typescript
const orderSchema = z.object({
  machine_id: z.string().min(5, "Seleccione la maquinaria asociada"),
  description: z.string().min(5, "Describa el trabajo a realizar"),
  assigned_mechanic_id: z.string().min(1, "Seleccione el mecánico asignado"),
});
```

Add the mechanics query next to the machines query (line 42):
```typescript
  const { data: machines = [] } = useMachines({ status: "ACTIVA" }); // Programar solo en máquinas activas
  const { data: mechanics = [] } = useMechanics();
```

Fix the hardcoded default (line 51):
```typescript
      assigned_mechanic_id: "", // El usuario debe seleccionar un mecánico real
```

Replace the description `<Input>` (lines 139-159) with a `<Textarea>`:
```tsx
                <form.Field name="description">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="text-slate-300 text-xs">Descripción del Servicio / Falla</Label>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ej. Cambio de filtros de aceite motor a las 500 hrs..."
                        rows={4}
                        className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                      />
                      {field.state.meta.errors.map((error) => (
                        <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                          {getErrorMessage(error)}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>
```

Replace the mechanic `<Input>` (lines 162-181) with a `<Select>`, matching the machine selector's pattern:
```tsx
                <form.Field name="assigned_mechanic_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name} className="text-slate-300 text-xs">Mecánico Asignado</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(val) => field.handleChange(val)}
                      >
                        <SelectTrigger className="bg-slate-950/80 border-slate-800 rounded-xl text-slate-300">
                          <SelectValue placeholder="Seleccione un mecánico" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
                          {mechanics.length === 0 ? (
                            <SelectItem value="none" disabled>No hay mecánicos registrados</SelectItem>
                          ) : (
                            mechanics.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {field.state.meta.errors.map((error) => (
                        <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                          {getErrorMessage(error)}
                        </p>
                      ))}
                    </div>
                  )}
                </form.Field>
```

- [ ] **Step 5: Manual verification**

Start the dev stack, log in as Administrador or Supervisor, open "Programar Orden (OT)":
- Confirm the "Mecánico Asignado" field is now a dropdown listing real mechanics by name (requires at least one user with role Mecánico registered — use the Usuarios page from Task 6/7 or existing seed data).
- Confirm the description field is a multi-line textarea.
- Fill in machine + description + mechanic and submit — confirm the OT is created successfully (this was the "can't save" bug) and appears in the Kanban board.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/textarea.tsx apps/web/src/features/mantenimiento/types.ts apps/web/src/features/mantenimiento/hooks/use-maintenance.ts apps/web/src/routes/_authenticated.mantenimiento.index.tsx
git commit -m "fix(web): selector de mecanico real en OT, corrige bug de guardado y agranda descripcion"
```

---

### Task 6: Frontend — unify password length and add name character validation

**Files:**
- Modify: `apps/web/src/routes/_authenticated.usuarios.tsx`

**Interfaces:** none (leaf UI validation change).

- [ ] **Step 1: Update the zod schema**

In `apps/web/src/routes/_authenticated.usuarios.tsx`, replace the `userSchema` (lines 24-29):

```typescript
const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ' -]+$/;

const userSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .regex(NAME_PATTERN, "El nombre solo puede contener letras, espacios, apóstrofes y guiones"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["admin", "supervisor", "mechanic"]),
});
```

- [ ] **Step 2: Update the password field placeholder to reflect the new minimum**

Line 265, change the placeholder from `"••••••••"` to `"•••••••• (mínimo 8 caracteres)"`:

```tsx
                      placeholder="•••••••• (mínimo 8 caracteres)"
```

- [ ] **Step 3: Manual verification**

Start the dev stack, log in as Administrador, open "Registrar Usuario":
- Try a 6-character password — confirm the form now blocks it client-side with the updated message.
- Try a name containing `@` (e.g. `Juan@Perez`) — confirm it's blocked with the character-set message.
- Try a real Spanish name with accents/ñ (e.g. `José Ñáñez`) — confirm it's accepted.
- Register a valid user with an 8+ character password — confirm it still succeeds end-to-end (this exercises Task 7's server-side hook too).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated.usuarios.tsx
git commit -m "fix(web): unifica minimo de password a 8 caracteres y valida nombre sin simbolos"
```

---

### Task 7: Backend (Better-Auth) — enforce password length and name pattern server-side

**Files:**
- Modify: `packages/auth/src/index.ts`

**Interfaces:** none (leaf server-side validation change, mirrors Task 6's frontend rule so it can't be bypassed by calling the API directly).

- [ ] **Step 1: Set `minPasswordLength` explicitly**

In `packages/auth/src/index.ts`, update the `emailAndPassword` block (lines 48-54):

```typescript
    emailAndPassword: {
      enabled: true,
      // El registro público está deshabilitado: las cuentas se crean únicamente
      // vía /create-admin (clave de creación) usando auth.api.createUser, que no
      // pasa por este guard.
      disableSignUp: true,
      // Antes dependíamos del default implícito de Better Auth (8). Lo fijamos
      // explícitamente para que quede documentado y no se rompa si la librería
      // cambia su default en una futura versión.
      minPasswordLength: 8,
    },
```

- [ ] **Step 2: Extend the existing `hooks.before` to validate the name on user creation**

In `packages/auth/src/index.ts`, the `hooks.before` function currently only checks `ctx.path === "/admin/remove-user" || ctx.path === "/admin/set-role"`. Add a new branch for `/admin/create-user` (Better-Auth's admin-plugin endpoint, body fields: `email`, `password`, `name`, `role`):

```typescript
    hooks: {
      before: async (ctx) => {
        if (ctx.path === "/admin/create-user") {
          const body = ctx.body as { name?: string } | undefined;
          const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ' -]+$/;
          if (body?.name && !NAME_PATTERN.test(body.name)) {
            throw new APIError("BAD_REQUEST", {
              message: "El nombre solo puede contener letras, espacios, apóstrofes y guiones."
            });
          }
        }

        if (ctx.path === "/admin/remove-user" || ctx.path === "/admin/set-role") {
          const body = ctx.body as { userId?: string; role?: string } | undefined;
          if (body?.userId) {
            // 1. Evitar auto-acciones (auto-eliminación o auto-cambio de rol)
            const currentUserId = ctx.context.session?.user?.id;
            if (currentUserId && body.userId === currentUserId) {
              throw new APIError("BAD_REQUEST", {
                message: "No está permitido cambiar tu propio rol o eliminar tu propia cuenta para evitar bloqueos del sistema."
              });
            }

            // 2. Evitar eliminar o cambiar el rol de cualquier administrador
            const targetUser = await ctx.context.internalAdapter.findUserById(body.userId);
            if (targetUser && targetUser.role === "admin") {
              throw new APIError("BAD_REQUEST", {
                message: "No está permitido eliminar o alterar el nivel de acceso de un usuario Administrador por motivos de seguridad."
              });
            }
          }
        }
      }
    },
```

- [ ] **Step 3: Manual verification**

Since `packages/auth` has no test runner configured, verify against the running dev stack:
- With the frontend guard from Task 6 temporarily bypassed (e.g. via a raw `curl -X POST` to the Better-Auth create-user endpoint with a name containing `@`, using an admin session cookie/JWT), confirm the server rejects it with the Spanish message.
- Confirm a normal user creation (valid name, 8+ character password) via the Usuarios UI still succeeds.
- Confirm creating a user with a 6-character password now fails server-side too (e.g. via the same raw request bypassing the frontend), proving Task 6's frontend check isn't the only line of defense.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "fix(auth): fija minPasswordLength=8 y valida nombre sin simbolos en create-user"
```

---

## Plan Self-Review

**Spec coverage:**
- Auditoría "Invalid Date" + "Realizado por" → Tasks 1, 2, 3. ✓
- Selector de mecánico + textarea + bug de guardado → Tasks 4, 5. ✓
- Password unificado a 8 → Tasks 6, 7. ✓
- Regex de nombre → Tasks 6, 7. ✓
- Machine selector (confirmed already correct, out of scope per user) → intentionally no task. ✓

**Placeholder scan:** no TBD/TODO; every step has literal file paths and complete code.

**Type consistency check:**
- `resolve_user_names(session, user_ids) -> dict[str, str]` (Task 1) is called identically in Task 2 (`resolve_user_names(uow.session, performed_by_ids)`) and Task 4 (`resolve_user_names(uow.session, [...])`). ✓
- `AuditLogResponse.performed_by_name` (Task 2) matches the frontend field name used in Task 3. ✓
- `MechanicResponse.id` / `.name` (Task 4) matches the frontend `MechanicResponse` interface and the `mechanics.map((m) => ...)` usage in Task 5. ✓
- `useMechanics()` (Task 5) return type matches `MechanicResponse[]` from Task 4's endpoint. ✓
- `assigned_mechanic_id` sent by the fixed frontend Select (Task 5, `value={m.id}` where `m` is a `MechanicResponse` whose `id` is `user_metadata.id`) matches exactly what the backend's `CreateMaintenanceCommand.assigned_mechanic_id: UUID` expects (looked up via `user_metadata_repo.get_by_id`, confirmed in `maintenance/domain/services.py:35`). This is the actual fix for the "can't save" bug. ✓
