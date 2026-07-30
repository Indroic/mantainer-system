"""Exportaciones profesionales del reporte analítico en PDF y Excel (spec 4.4).

Ambos formatos comparten la misma estructura de secciones que la pantalla de
reportes, de modo que lo impreso coincide con lo que el usuario ve.
"""

from __future__ import annotations

from src.features.reports.application.dtos import (
    AnalyticsReportResponse,
    FleetStatusResponse,
)
from src.shared.infrastructure.reporting.excel import Column, ExcelWorkbook
from src.shared.infrastructure.reporting.pdf import (
    PdfDocument,
    format_currency,
    format_number,
    format_percent,
)


def _scope_subtitle(report: AnalyticsReportResponse) -> str:
    """Línea de contexto: periodo, alcance y segmentación aplicada."""
    scope = (
        f"Activo individual: {report.machine_code or report.machine_id}"
        if report.scope.value == "INDIVIDUAL"
        else "Alcance general (toda la empresa)"
    )
    parts = [f"Periodo: {report.resolved_period.label}", scope]
    if report.failure_category:
        parts.append(f"Clasificación de falla: {report.failure_category}")
    return " · ".join(parts)


# ===========================================================================
# PDF
# ===========================================================================
def render_analytics_pdf(report: AnalyticsReportResponse) -> bytes:
    """Genera el PDF del reporte analítico de mantenimiento."""
    doc = PdfDocument(
        title="Reporte Analítico de Mantenimiento",
        subtitle=_scope_subtitle(report),
        orientation="landscape",
    )

    totals = report.totals
    doc.add_metric_cards(
        [
            ("Gasto en repuestos", format_currency(totals.total_spare_parts_cost)),
            ("Órdenes de trabajo", format_number(totals.total_orders)),
            ("OT liquidadas", format_number(totals.liquidated_orders)),
            ("Unidades consumidas", format_number(totals.total_units_consumed)),
            ("Costo medio por OT", format_currency(totals.average_cost_per_order)),
        ]
    )

    # --- Maquinaria con más gastos acumulados --------------------------------
    doc.add_section("Maquinaria con más gastos acumulados")
    doc.add_table(
        ["#", "Código", "Marca", "Modelo", "OT", "Gasto acumulado", "% del total"],
        [
            [
                index,
                item.machine_code,
                item.machine_brand or "—",
                item.machine_model or "—",
                format_number(item.orders_count),
                format_currency(item.total_cost),
                format_percent(item.percentage),
            ]
            for index, item in enumerate(report.top_machines_by_cost, start=1)
        ],
        column_widths=[0.5, 1.4, 1.6, 1.6, 0.8, 1.6, 1.1],
        align_right=(4, 5, 6),
        align_center=(0,),
    )

    # --- Repuestos más utilizados -------------------------------------------
    doc.add_section("Partes / repuestos más utilizados")
    doc.add_table(
        ["#", "Código", "Repuesto", "Unidades", "OT", "Costo acumulado", "% del total"],
        [
            [
                index,
                item.spare_part_code,
                item.spare_part_name,
                format_number(item.total_quantity),
                format_number(item.orders_count),
                format_currency(item.total_cost),
                format_percent(item.percentage),
            ]
            for index, item in enumerate(report.top_spare_parts, start=1)
        ],
        column_widths=[0.5, 1.4, 3.0, 1.0, 0.8, 1.6, 1.1],
        align_right=(3, 4, 5, 6),
        align_center=(0,),
    )

    # --- Índice de averías --------------------------------------------------
    doc.add_section("Máquinas con mayor índice de averías")
    doc.add_table(
        ["#", "Código", "Marca / Modelo", "Averías", "% de averías", "Costo asociado"],
        [
            [
                index,
                item.machine_code,
                f"{item.machine_brand or '—'} {item.machine_model or ''}".strip(),
                format_number(item.failures_count),
                format_percent(item.percentage),
                format_currency(item.total_cost),
            ]
            for index, item in enumerate(report.top_machines_by_failures, start=1)
        ],
        column_widths=[0.5, 1.4, 2.8, 1.0, 1.2, 1.6],
        align_right=(3, 4, 5),
        align_center=(0,),
    )

    # --- Distribución por clasificación de falla ----------------------------
    if report.failures_by_category:
        doc.add_section("Distribución por clasificación de falla")
        doc.add_table(
            ["Clasificación", "Averías", "% del total", "Costo asociado"],
            [
                [
                    item.label,
                    format_number(item.count),
                    format_percent(item.percentage),
                    format_currency(item.total_cost),
                ]
                for item in report.failures_by_category
            ],
            column_widths=[3.0, 1.0, 1.2, 1.6],
            align_right=(1, 2, 3),
        )

    # --- Evolución del gasto ------------------------------------------------
    if report.cost_trend:
        doc.add_section("Evolución del gasto en el periodo")
        doc.add_table(
            ["Periodo", "Órdenes", "Gasto"],
            [
                [b.label, format_number(b.orders_count), format_currency(b.total_cost)]
                for b in report.cost_trend
            ],
            column_widths=[2.0, 1.0, 1.6],
            align_right=(1, 2),
            total_row=[
                "TOTAL",
                format_number(sum(b.orders_count for b in report.cost_trend)),
                format_currency(sum(b.total_cost for b in report.cost_trend)),
            ],
        )

    return doc.render()


def render_fleet_status_pdf(fleet: FleetStatusResponse) -> bytes:
    """PDF del estado de la flota en porcentajes (spec 4.3)."""
    doc = PdfDocument(
        title="Estado de la Flota",
        subtitle="Distribución operativa de la maquinaria pesada, en unidades y porcentaje.",
    )
    doc.add_metric_cards(
        [("Máquinas operativas en flota", format_number(fleet.total_machines))]
    )
    doc.add_table(
        ["Estado", "Máquinas", "Porcentaje"],
        [
            [s.label, format_number(s.count), format_percent(s.percentage)]
            for s in fleet.slices
        ],
        column_widths=[2.4, 1.0, 1.2],
        align_right=(1, 2),
        total_row=[
            "TOTAL",
            format_number(fleet.total_machines),
            format_percent(sum(s.percentage for s in fleet.slices)),
        ],
    )
    return doc.render()


# ===========================================================================
# Excel
# ===========================================================================
def render_analytics_xlsx(report: AnalyticsReportResponse) -> bytes:
    """Genera el libro Excel del reporte analítico, una hoja por bloque."""
    wb = ExcelWorkbook()
    subtitle = _scope_subtitle(report)
    totals = report.totals

    # --- Resumen ------------------------------------------------------------
    wb.add_sheet(
        title="Resumen del Reporte Analítico",
        sheet_title="Resumen",
        subtitle=subtitle,
        columns=[Column("Indicador", "text", width=34), Column("Valor", "text", width=22)],
        rows=[
            ["Periodo", report.resolved_period.label],
            ["Alcance", report.scope.value],
            ["Máquina", report.machine_code or "Todas"],
            ["Clasificación de falla", report.failure_category or "Todas"],
            ["Gasto total en repuestos", format_currency(totals.total_spare_parts_cost)],
            ["Órdenes de trabajo", totals.total_orders],
            ["OT liquidadas", totals.liquidated_orders],
            ["OT abiertas", totals.open_orders],
            ["Unidades de repuesto consumidas", totals.total_units_consumed],
            ["Máquinas con intervenciones", totals.machines_with_failures],
            ["Costo medio por OT", format_currency(totals.average_cost_per_order)],
        ],
        autofilter=False,
    )

    # --- Gastos por maquinaria ---------------------------------------------
    wb.add_sheet(
        title="Maquinaria con más gastos acumulados",
        sheet_title="Gastos por máquina",
        subtitle=subtitle,
        columns=[
            Column("Código", "text"),
            Column("Marca", "text"),
            Column("Modelo", "text"),
            Column("Órdenes", "integer"),
            Column("Gasto acumulado", "currency"),
            Column("% del total", "percent"),
        ],
        rows=[
            [
                item.machine_code,
                item.machine_brand,
                item.machine_model,
                item.orders_count,
                item.total_cost,
                item.percentage,
            ]
            for item in report.top_machines_by_cost
        ],
        total_row=[
            "TOTAL",
            None,
            None,
            sum(i.orders_count for i in report.top_machines_by_cost),
            sum(i.total_cost for i in report.top_machines_by_cost),
            sum(i.percentage for i in report.top_machines_by_cost),
        ],
    )

    # --- Repuestos más usados ----------------------------------------------
    wb.add_sheet(
        title="Partes / repuestos más utilizados",
        sheet_title="Repuestos más usados",
        subtitle=subtitle,
        columns=[
            Column("Código", "text"),
            Column("Repuesto", "text", width=38),
            Column("Unidades", "integer"),
            Column("Órdenes", "integer"),
            Column("Costo acumulado", "currency"),
            Column("% del total", "percent"),
        ],
        rows=[
            [
                item.spare_part_code,
                item.spare_part_name,
                item.total_quantity,
                item.orders_count,
                item.total_cost,
                item.percentage,
            ]
            for item in report.top_spare_parts
        ],
        total_row=[
            "TOTAL",
            None,
            sum(i.total_quantity for i in report.top_spare_parts),
            None,
            sum(i.total_cost for i in report.top_spare_parts),
            sum(i.percentage for i in report.top_spare_parts),
        ],
    )

    # --- Índice de averías --------------------------------------------------
    wb.add_sheet(
        title="Máquinas con mayor índice de averías",
        sheet_title="Índice de averías",
        subtitle=subtitle,
        columns=[
            Column("Código", "text"),
            Column("Marca", "text"),
            Column("Modelo", "text"),
            Column("Averías", "integer"),
            Column("% de averías", "percent"),
            Column("Costo asociado", "currency"),
        ],
        rows=[
            [
                item.machine_code,
                item.machine_brand,
                item.machine_model,
                item.failures_count,
                item.percentage,
                item.total_cost,
            ]
            for item in report.top_machines_by_failures
        ],
    )

    # --- Clasificación de fallas -------------------------------------------
    if report.failures_by_category:
        wb.add_sheet(
            title="Distribución por clasificación de falla",
            sheet_title="Clasificación de fallas",
            subtitle=subtitle,
            columns=[
                Column("Clasificación", "text", width=30),
                Column("Averías", "integer"),
                Column("% del total", "percent"),
                Column("Costo asociado", "currency"),
            ],
            rows=[
                [item.label, item.count, item.percentage, item.total_cost]
                for item in report.failures_by_category
            ],
        )

    # --- Evolución del gasto ------------------------------------------------
    if report.cost_trend:
        wb.add_sheet(
            title="Evolución del gasto en el periodo",
            sheet_title="Evolución del gasto",
            subtitle=subtitle,
            columns=[
                Column("Periodo", "text"),
                Column("Órdenes", "integer"),
                Column("Gasto", "currency"),
            ],
            rows=[[b.label, b.orders_count, b.total_cost] for b in report.cost_trend],
            total_row=[
                "TOTAL",
                sum(b.orders_count for b in report.cost_trend),
                sum(b.total_cost for b in report.cost_trend),
            ],
        )

    return wb.render()
