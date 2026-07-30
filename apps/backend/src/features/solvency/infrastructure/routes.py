from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    CAN_VIEW_SOLVENCIES,
    CurrentUser,
    require_roles,
)
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.notifications.domain.entities import (
    NotificationSeverity,
    NotificationType,
)
from src.features.notifications.infrastructure.routes import build_notification_service
from src.features.solvency.application.dtos import SolvencyResponse
from src.features.solvency.application.use_cases.query_solvencies import (
    to_solvency_response,
)
from src.features.solvency.domain.entities import SolvencyStatus
from src.features.solvency.domain.services import SolvencyDomainService
from src.features.solvency.infrastructure.pdf_renderer import (
    render_solvency_pdf,
    solvency_pdf_filename,
)
from src.features.solvency.infrastructure.repositories import SolvencyRepository
from src.features.user.domain.entities import UserRole
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/solvencies", tags=["Spare Part Solvencies"])

#: Solo Almacén y el Planificador confirman la entrega física de las piezas.
CAN_DISPATCH = [UserRole.ALMACEN, UserRole.PLANIFICADOR]


def build_solvency_service(uow: SqlAlchemyUnitOfWork) -> SolvencyDomainService:
    """Construye el servicio de Solvencias sobre el UoW dado.

    Igual que en notificaciones, se expone como función para que la slice de
    mantenimiento pueda emitir Solvencias dentro de su propia transacción.
    """
    return SolvencyDomainService(
        solvency_repo=SolvencyRepository(uow),
        spare_part_repo=SparePartRepository(uow),
        machine_repo=MachineRepository(uow),
    )


def get_solvency_service(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> SolvencyDomainService:
    return build_solvency_service(uow)


@router.get("/", response_model=list[SolvencyResponse])
async def list_solvencies(
    status_filter: str | None = None,
    machine_id: str | None = None,
    order_id: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: SolvencyDomainService = Depends(get_solvency_service),
    current_user: CurrentUser = Depends(require_roles(CAN_VIEW_SOLVENCIES)),
) -> list[SolvencyResponse]:
    """Listado de Solvencias emitidas: es la bandeja de despacho de Almacén.

    Permite filtrar por estado (``PENDIENTE_DESPACHO`` / ``DESPACHADO``), por
    máquina o por Orden de Trabajo.
    """
    if order_id:
        solvencies = await service.list_by_order(UUID(order_id))
    else:
        solvencies = await service.list_filtered(
            status=status_filter,
            machine_id=UUID(machine_id) if machine_id else None,
        )

    return [await to_solvency_response(s, uow) for s in solvencies]


@router.get("/{solvency_id}", response_model=SolvencyResponse)
async def get_solvency(
    solvency_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: SolvencyDomainService = Depends(get_solvency_service),
    current_user: CurrentUser = Depends(require_roles(CAN_VIEW_SOLVENCIES)),
) -> SolvencyResponse:
    """Detalle de una Solvencia de Repuestos."""
    solvency = await service.get_by_id(UUID(solvency_id))
    return await to_solvency_response(solvency, uow)


@router.get("/{solvency_id}/pdf")
async def download_solvency_pdf(
    solvency_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: SolvencyDomainService = Depends(get_solvency_service),
    current_user: CurrentUser = Depends(require_roles(CAN_VIEW_SOLVENCIES)),
) -> Response:
    """Descarga el comprobante PDF de la Solvencia.

    Disponible desde el detalle de la OT y desde la bandeja de Almacén (spec 3.3).
    """
    solvency = await service.get_by_id(UUID(solvency_id))
    dto = await to_solvency_response(solvency, uow)
    pdf_bytes = render_solvency_pdf(dto)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{solvency_pdf_filename(dto)}"'
        },
    )


@router.put("/{solvency_id}/dispatch", response_model=SolvencyResponse)
async def dispatch_solvency(
    solvency_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: SolvencyDomainService = Depends(get_solvency_service),
    current_user: CurrentUser = Depends(require_roles(CAN_DISPATCH)),
) -> SolvencyResponse:
    """Almacén confirma la entrega física de las piezas amparadas por la Solvencia."""
    target_id = UUID(solvency_id)

    async with uow:
        solvency = await service.mark_dispatched(
            target_id, current_user.better_auth_user_id
        )

        # Avisar al Planificador y al Supervisor de que las piezas ya salieron.
        notifications = build_notification_service(uow)
        await notifications.notify_roles(
            [UserRole.PLANIFICADOR, UserRole.SUPERVISOR],
            type=NotificationType.SOLVENCIA_EMITIDA,
            title=f"Repuestos despachados · {solvency.code}",
            message=(
                f"Almacén entregó {solvency.total_units} unidad(es) de la Solvencia "
                f"{solvency.code} para la maquinaria {solvency.machine_code or solvency.machine_id}."
            ),
            severity=NotificationSeverity.INFO,
            link=f"/mantenimiento/{solvency.maintenance_order_id}",
            related_entity_id=solvency.id,
        )
        await uow.commit()

    refreshed = await service.get_by_id(target_id)
    return await to_solvency_response(refreshed, uow)
