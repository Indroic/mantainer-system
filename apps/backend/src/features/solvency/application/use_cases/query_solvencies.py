from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.solvency.application.dtos import (
    SolvencyItemResponse,
    SolvencyResponse,
)
from src.features.solvency.domain.entities import SparePartSolvency


async def to_solvency_response(
    solvency: SparePartSolvency, uow: SqlAlchemyUnitOfWork
) -> SolvencyResponse:
    """Hidrata la Solvencia con nombres de usuario y la descripción de la OT.

    Los datos "de adorno" (nombres, descripción) se resuelven de forma tolerante:
    si el usuario fue eliminado o la OT ya no existe, el documento sigue siendo
    consultable y descargable.
    """
    from src.features.maintenance.infrastructure.repositories import (
        MaintenanceOrderRepository,
    )
    from src.shared.infrastructure.database.user_lookup import resolve_user_names

    # Nombres de los usuarios implicados (emisor y despachador).
    user_ids = [uid for uid in (solvency.issued_by, solvency.dispatched_by) if uid]
    names: dict[str, str] = {}
    if user_ids:
        try:
            names = await resolve_user_names(uow.session, user_ids)
        except Exception:
            names = {}

    # Descripción del trabajo amparado.
    order_description: str | None = None
    try:
        order_repo = MaintenanceOrderRepository(uow)
        order = await order_repo.get_by_id(solvency.maintenance_order_id)
        order_description = order.description
    except Exception:
        order_description = None

    return SolvencyResponse(
        id=solvency.id,
        code=solvency.code,
        maintenance_order_id=solvency.maintenance_order_id,
        machine_id=solvency.machine_id,
        machine_code=solvency.machine_code,
        issued_by=solvency.issued_by,
        issued_by_name=names.get(solvency.issued_by),
        status=solvency.status,
        dispatched_by=solvency.dispatched_by,
        dispatched_by_name=(
            names.get(solvency.dispatched_by) if solvency.dispatched_by else None
        ),
        notes=solvency.notes,
        items=[
            SolvencyItemResponse(
                id=item.id,
                spare_part_id=item.spare_part_id,
                spare_part_code=item.spare_part_code,
                spare_part_name=item.spare_part_name,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                subtotal=item.subtotal,
            )
            for item in solvency.items
        ],
        total_cost=solvency.total_cost,
        total_units=solvency.total_units,
        order_description=order_description,
        created_at=solvency.created_at,
        updated_at=solvency.updated_at,
        is_active=solvency.is_active,
    )
