from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, Response
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    ALL_ROLES,
    CAN_VIEW_REPORTS,
    CAN_EXECUTE_ORDERS,
    require_roles,
)
from src.features.reports.application.dtos import (
    AnalyticsFilterCommand,
    AnalyticsReportResponse,
    CostReportFilterCommand,
    CostReportResponse,
    FleetStatusResponse,
    MachineTechnicalHistoryResponse,
    ReportPeriod,
    ReportScope,
)
from src.features.reports.application.use_cases.get_analytics import (
    GetAnalyticsReportUseCase,
)
from src.features.reports.application.use_cases.get_cost_report import (
    GetCostReportUseCase,
)
from src.features.reports.application.use_cases.get_fleet_status import (
    GetFleetStatusUseCase,
)
from src.features.reports.application.use_cases.get_technical_history import (
    GetMachineTechnicalHistoryUseCase,
)
from src.features.reports.infrastructure.exporters import (
    render_analytics_pdf,
    render_analytics_xlsx,
    render_fleet_status_pdf,
)
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/reports", tags=["Analytical Reports & History"])


def _parse_date(raw: str | None) -> datetime | None:
    """Acepta fechas ISO completas o simples ``AAAA-MM-DD``."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        try:
            return datetime.strptime(raw, "%Y-%m-%d")
        except ValueError:
            return None


def _analytics_command(
    period: str,
    scope: str,
    machine_id: str | None,
    failure_category: str | None,
    reference_date: str | None,
    start_date: str | None,
    end_date: str | None,
    limit: int,
) -> AnalyticsFilterCommand:
    """Construye el filtro de analítica desde query params (para descargas GET)."""
    return AnalyticsFilterCommand(
        period=ReportPeriod(period),
        scope=ReportScope(scope),
        machine_id=UUID(machine_id) if machine_id else None,
        failure_category=failure_category or None,
        reference_date=_parse_date(reference_date),
        start_date=_parse_date(start_date),
        end_date=_parse_date(end_date),
        limit=limit,
    )


@router.post(
    "/costs",
    response_model=CostReportResponse,
    dependencies=[Depends(require_roles(CAN_VIEW_REPORTS))],
)
async def get_cost_report(
    command: CostReportFilterCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> CostReportResponse:
    """Obtiene un reporte analítico agregado de costos de mantenimiento e inventario.

    Permite filtrar por máquina y por rango de fechas. Restringido a
    Administradores y Supervisores.
    """
    use_case = GetCostReportUseCase(uow)
    return await use_case.execute(command)


@router.get(
    "/costs",
    response_model=CostReportResponse,
    dependencies=[Depends(require_roles(CAN_VIEW_REPORTS))],
)
async def get_cost_report_get(
    machine_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> CostReportResponse:
    """Obtiene un reporte analítico de costos mediante GET."""
    from src.features.reports.application.dtos import CostReportFilterCommand
    from datetime import datetime
    
    start_dt = None
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                pass
            
    end_dt = None
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            except ValueError:
                pass

    from uuid import UUID
    machine_uuid = UUID(machine_id) if machine_id else None

    command = CostReportFilterCommand(
        machine_id=machine_uuid,
        start_date=start_dt,
        end_date=end_dt
    )
    use_case = GetCostReportUseCase(uow)
    return await use_case.execute(command)



@router.get(
    "/technical-history/{machine_id}",
    response_model=MachineTechnicalHistoryResponse,
    dependencies=[
        Depends(
            require_roles(CAN_EXECUTE_ORDERS)
        )
    ],
)
async def get_technical_history(
    machine_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> MachineTechnicalHistoryResponse:
    """Recupera la hoja de vida inmutable consolidada de una máquina.

    Muestra el historial cronológico de mantenimientos liquidados, costos, la
    clasificación de la falla y la descripción del trabajo realizado (spec 5.1).
    """
    use_case = GetMachineTechnicalHistoryUseCase(uow)
    return await use_case.execute(UUID(machine_id))


# ===========================================================================
# Analítica avanzada (spec 4.2) y estado de la flota (spec 4.3)
# ===========================================================================
@router.post(
    "/analytics",
    response_model=AnalyticsReportResponse,
    dependencies=[Depends(require_roles(CAN_VIEW_REPORTS))],
)
async def get_analytics_report(
    command: AnalyticsFilterCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> AnalyticsReportResponse:
    """Reporte analítico consolidado de mantenimiento.

    Devuelve, para un mismo periodo (Anual / Mensual / Semanal / personalizado) y
    alcance (General o Individual por máquina): maquinaria con más gastos
    acumulados, repuestos más utilizados, máquinas con mayor índice de averías,
    distribución por clasificación de falla y evolución del gasto.
    """
    use_case = GetAnalyticsReportUseCase(uow)
    return await use_case.execute(command)


@router.get(
    "/analytics",
    response_model=AnalyticsReportResponse,
    dependencies=[Depends(require_roles(CAN_VIEW_REPORTS))],
)
async def get_analytics_report_get(
    period: str = ReportPeriod.ANUAL.value,
    scope: str = ReportScope.GENERAL.value,
    machine_id: str | None = None,
    failure_category: str | None = None,
    reference_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 10,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> AnalyticsReportResponse:
    """Variante GET del reporte analítico, cómoda para enlaces y recargas."""
    command = _analytics_command(
        period, scope, machine_id, failure_category, reference_date, start_date, end_date, limit
    )
    use_case = GetAnalyticsReportUseCase(uow)
    return await use_case.execute(command)


@router.get(
    "/analytics/export",
    dependencies=[Depends(require_roles(CAN_VIEW_REPORTS))],
)
async def export_analytics_report(
    format: str = "pdf",
    period: str = ReportPeriod.ANUAL.value,
    scope: str = ReportScope.GENERAL.value,
    machine_id: str | None = None,
    failure_category: str | None = None,
    reference_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 10,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> Response:
    """Descarga el reporte analítico en PDF o Excel con formato profesional (spec 4.4)."""
    command = _analytics_command(
        period, scope, machine_id, failure_category, reference_date, start_date, end_date, limit
    )
    report = await GetAnalyticsReportUseCase(uow).execute(command)

    normalized = (format or "pdf").strip().lower()
    if normalized not in ("pdf", "xlsx", "excel"):
        raise ValueError("Formato de exportación inválido. Use 'pdf' o 'xlsx'.")

    suffix = report.resolved_period.label.replace(" ", "_").replace("/", "-")

    if normalized == "pdf":
        return Response(
            content=render_analytics_pdf(report),
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="reporte_analitico_{suffix}.pdf"'
                )
            },
        )

    return Response(
        content=render_analytics_xlsx(report),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="reporte_analitico_{suffix}.xlsx"'
            )
        },
    )


@router.get(
    "/fleet-status",
    response_model=FleetStatusResponse,
    dependencies=[Depends(require_roles(ALL_ROLES))],
)
async def get_fleet_status(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> FleetStatusResponse:
    """Estado de la flota en tiempo real, en unidades y porcentajes (spec 4.3).

    Alimenta el gráfico del dashboard: Activas / En Mantenimiento / Fuera de
    Servicio. Las máquinas dadas de baja quedan fuera del denominador.
    """
    use_case = GetFleetStatusUseCase(uow)
    return await use_case.execute()


@router.get(
    "/fleet-status/export",
    dependencies=[Depends(require_roles(CAN_VIEW_REPORTS))],
)
async def export_fleet_status(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> Response:
    """Descarga en PDF el estado de la flota."""
    fleet = await GetFleetStatusUseCase(uow).execute()
    return Response(
        content=render_fleet_status_pdf(fleet),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="estado_flota.pdf"'
        },
    )

