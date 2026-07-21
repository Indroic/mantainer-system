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


async def list_users_with_roles(session: AsyncSession) -> list[tuple[str, str, str | None]]:
    """Devuelve ``(id, name, role)`` de todos los usuarios de Better Auth.

    La fuente de verdad del ciclo de vida y de los roles de usuario es Better
    Auth (tabla ``user``). El backend Hexcore solo la lee para, p. ej., resolver
    los usuarios de un rol concreto sin depender de que ``user_metadata`` esté
    poblada. El rol se normaliza aguas arriba (`_parse_role`).
    """
    stmt = select(user_table.c.id, user_table.c.name, user_table.c.role)
    result = await session.execute(stmt)
    return [(row.id, row.name, row.role) for row in result.all()]
