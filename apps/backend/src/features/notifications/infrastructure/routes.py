from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import ALL_ROLES, CurrentUser, require_roles
from src.features.notifications.application.dtos import (
    MarkAllReadResponse,
    NotificationInboxResponse,
    NotificationResponse,
)
from src.features.notifications.application.use_cases.mark_read import (
    MarkAllNotificationsReadUseCase,
    MarkNotificationReadUseCase,
)
from src.features.notifications.application.use_cases.query_notifications import (
    QueryNotificationInboxUseCase,
)
from src.features.notifications.domain.exceptions import (
    NotificationForbiddenException,
)
from src.features.notifications.domain.services import NotificationDomainService
from src.features.notifications.infrastructure.repositories import (
    NotificationRepository,
)
from src.shared.infrastructure.database.db import get_uow
from src.shared.infrastructure.database.user_lookup import list_users_with_roles

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def build_notification_service(uow: SqlAlchemyUnitOfWork) -> NotificationDomainService:
    """Construye el servicio de notificaciones sobre el UoW dado.

    Se expone como función (no solo como dependencia de FastAPI) porque los casos
    de uso de otras slices (mantenimiento, alertas, solvencia) necesitan emitir
    notificaciones dentro de su propia transacción.
    """
    return NotificationDomainService(
        notification_repo=NotificationRepository(uow),
        user_directory=lambda: list_users_with_roles(uow.session),
    )


def get_notification_service(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> NotificationDomainService:
    return build_notification_service(uow)


@router.get("/", response_model=NotificationInboxResponse)
async def get_inbox(
    only_unread: bool = False,
    limit: int = 100,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: NotificationDomainService = Depends(get_notification_service),
    current_user: CurrentUser = Depends(require_roles(ALL_ROLES)),
) -> NotificationInboxResponse:
    """Bandeja de notificaciones del usuario autenticado, con contador de no leídas.

    El filtrado por rol se aplica en el servidor: el Mecánico nunca ve alertas de
    bajo stock, aunque existan filas antiguas de ese tipo dirigidas a él.
    """
    use_case = QueryNotificationInboxUseCase(service, uow)
    return await use_case.execute(
        current_user.better_auth_user_id,
        role=current_user.role,
        only_unread=only_unread,
        limit=max(1, min(limit, 200)),
    )


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: NotificationDomainService = Depends(get_notification_service),
    current_user: CurrentUser = Depends(require_roles(ALL_ROLES)),
) -> NotificationResponse:
    """Marca como leída una notificación propia."""
    use_case = MarkNotificationReadUseCase(service, uow)
    try:
        return await use_case.execute(
            UUID(notification_id), current_user.better_auth_user_id
        )
    except NotificationForbiddenException as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)
        ) from exc


@router.put("/read-all", response_model=MarkAllReadResponse)
async def mark_all_read(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    service: NotificationDomainService = Depends(get_notification_service),
    current_user: CurrentUser = Depends(require_roles(ALL_ROLES)),
) -> MarkAllReadResponse:
    """Marca como leídas todas las notificaciones del usuario autenticado."""
    use_case = MarkAllNotificationsReadUseCase(service, uow)
    return await use_case.execute(current_user.better_auth_user_id)
