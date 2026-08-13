"""Exportación de Órdenes de Trabajo (spec 4.4).

Dos productos distintos, con el mismo juego de columnas:

* El **listado** de OT en Excel / CSV / PDF, para control y archivo del tablero.
* La **hoja de OT** individual en PDF, con los datos del activo, el detalle de
  repuestos y las líneas de firma, que es el documento que circula por el taller.

El costo unitario de un repuesto solo se congela al liquidar la OT
(``unit_cost_at_time`` es ``None`` antes de eso), así que las cifras de una OT
abierta son una ESTIMACIÓN tomada del catálogo vigente. Eso se calcula en un
único sitio (:func:`spare_part_unit_cost`) y se advierte en el documento: dar por
definitivo un importe estimado sería un error contable.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Sequence

from src.features.maintenance.domain.entities import (
    MaintenanceStatus,
    failure_category_label,
)
from src.shared.infrastructure.reporting.excel import Column, ExcelWorkbook
from src.shared.infrastructure.reporting.pdf import (
    PdfDocument,
    format_currency,
    format_number,
)

# ---------------------------------------------------------------------------
# Etiquetas de dominio
# ---------------------------------------------------------------------------
STATUS_LABELS: dict[str, str] = {
    MaintenanceStatus.PROGRAMADO.value: "Programado",
    MaintenanceStatus.EN_EJECUCION.value: "En ejecución",
    MaintenanceStatus.LIQUIDADO.value: "Liquidado",
}


def status_label(status) -> str:
    """Etiqueta legible del estado de la OT."""
    raw = getattr(status, "value", status)
    return STATUS_LABELS.get(str(raw), str(raw or "—"))


# ---------------------------------------------------------------------------
# Costos
# ---------------------------------------------------------------------------
def spare_part_unit_cost(item) -> tuple[float, bool]:
    """Costo unitario del repuesto y si es histórico (congelado) o estimado.

    Devuelve ``(valor, es_historico)``. Antes de liquidar, ``unit_cost_at_time``
    es ``None``: se estima con el costo vigente del catálogo para no informar
    0,00 en una OT abierta, pero marcándolo como estimación.
    """
    historical = getattr(item, "unit_cost_at_time", None)
    if historical is not None:
        return float(historical), True

    part = getattr(item, "spare_part", None)
    catalog = getattr(part, "unit_cost_usd", None) or getattr(part, "unit_cost", None)
    return float(catalog or 0.0), False


def spare_part_quantity(item) -> int:
    """Cantidad solicitada del repuesto, tolerando el alias ``quantity``."""
    raw = getattr(item, "quantity_requested", None)
    if raw is None:
        raw = getattr(item, "quantity", None)
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


def order_parts_total(order) -> float:
    """Costo total de los repuestos de una OT (histórico o estimado)."""
    return sum(
        spare_part_quantity(item) * spare_part_unit_cost(item)[0]
        for item in (getattr(order, "spare_parts", None) or [])
    )


def order_units_total(order) -> int:
    """Unidades de repuesto solicitadas en la OT."""
    return sum(
        spare_part_quantity(item)
        for item in (getattr(order, "spare_parts", None) or [])
    )


def _has_estimated_costs(orders: Sequence) -> bool:
    """``True`` si alguna OT aporta importes estimados (aún no liquidados)."""
    return any(
        not spare_part_unit_cost(item)[1]
        and spare_part_quantity(item) > 0
        for order in orders
        for item in (getattr(order, "spare_parts", None) or [])
    )


# ---------------------------------------------------------------------------
# Definición de columnas del listado
# ---------------------------------------------------------------------------
ORDER_COLUMNS: list[Column] = [
    Column("Código de OT", "text", width=14),
    Column("Fecha de Registro", "text", width=18),
    Column("Estado", "text", width=14),
    Column("Máquina", "text", width=14),
    Column("Marca / Modelo", "text", width=24),
    Column("Clasificación de Falla", "text", width=24),
    Column("Descripción del Servicio", "text", width=46),
    Column("Trabajo Realizado", "text", width=46),
    Column("Mecánico Asignado", "text", width=22),
    Column("Registrado por", "text", width=22),
    Column("Repuestos", "integer"),
    Column("Unidades", "integer"),
    Column("Costo de Repuestos", "currency"),
    Column("Próximo Servicio (Horómetro)", "decimal"),
]


def order_code(order) -> str:
    """Folio corto y estable de la OT, derivado de su identificador."""
    return f"OT-{str(order.id)[:8].upper()}"


def _machine_of(order):
    return getattr(order, "machine", None)


def _format_datetime(value) -> str:
    return value.strftime("%d/%m/%Y %H:%M") if value else "—"


def _order_row(order) -> list:
    """Fila del listado de OT, compartida por Excel, CSV y PDF."""
    machine = _machine_of(order)
    parts = getattr(order, "spare_parts", None) or []
    return [
        order_code(order),
        _format_datetime(getattr(order, "created_at", None)),
        status_label(getattr(order, "status", None)),
        getattr(machine, "code", None) or "—",
        f"{getattr(machine, 'brand', '') or ''} {getattr(machine, 'model', '') or ''}".strip()
        or "—",
        getattr(order, "failure_category_label", None)
        or failure_category_label(getattr(order, "failure_category", None)),
        getattr(order, "description", None) or "—",
        getattr(order, "work_performed", None) or "—",
        getattr(order, "assigned_mechanic_name", None) or "—",
        getattr(order, "created_by_name", None) or "—",
        len(parts),
        order_units_total(order),
        order_parts_total(order),
        getattr(order, "next_service_horometer", None),
    ]


# ---------------------------------------------------------------------------
# Exportación del listado
# ---------------------------------------------------------------------------
def render_orders_xlsx(orders: Sequence, *, scope_label: str = "Todas las OT") -> bytes:
    """Listado de OT en Excel, con totales y formato de moneda."""
    rows = [_order_row(order) for order in orders]

    return _workbook_with_orders(orders, rows, scope_label).render()


def _workbook_with_orders(orders: Sequence, rows: list[list], scope_label: str):
    liquidated = sum(
        1
        for o in orders
        if str(getattr(getattr(o, "status", None), "value", getattr(o, "status", "")))
        == MaintenanceStatus.LIQUIDADO.value
    )
    subtitle = (
        f"SGMM Portal · {len(orders)} orden(es) · {scope_label} · "
        f"{liquidated} liquidada(s)"
    )
    if _has_estimated_costs(orders):
        subtitle += " · Los importes de las OT no liquidadas son estimados"

    wb = ExcelWorkbook()
    wb.add_sheet(
        title="Órdenes de Trabajo",
        sheet_title="Órdenes de Trabajo",
        subtitle=subtitle,
        columns=ORDER_COLUMNS,
        rows=rows,
        total_row=[
            "TOTAL",
            None,
            f"{liquidated} liquidada(s)",
            f"{len(orders)} OT",
            None,
            None,
            None,
            None,
            None,
            None,
            sum(len(getattr(o, "spare_parts", None) or []) for o in orders),
            sum(order_units_total(o) for o in orders),
            sum(order_parts_total(o) for o in orders),
            None,
        ],
    )
    return wb


def render_orders_csv(orders: Sequence) -> str:
    """Listado de OT en CSV, con las mismas columnas que el Excel."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([column.header for column in ORDER_COLUMNS])
    for order in orders:
        writer.writerow(["" if value is None else value for value in _order_row(order)])
    # BOM para que Excel abra el CSV respetando los acentos.
    return "﻿" + output.getvalue()


def render_orders_pdf(orders: Sequence, *, scope_label: str = "Todas las OT") -> bytes:
    """Listado de OT en PDF horizontal, con indicadores de cabecera."""
    doc = PdfDocument(
        title="Órdenes de Trabajo",
        subtitle=(
            f"Control de reparaciones y mantenimientos del taller · "
            f"{len(orders)} orden(es) · {scope_label}."
        ),
        orientation="landscape",
    )

    by_status: dict[str, int] = {}
    for order in orders:
        raw = getattr(getattr(order, "status", None), "value", getattr(order, "status", ""))
        by_status[str(raw)] = by_status.get(str(raw), 0) + 1

    doc.add_metric_cards(
        [
            ("Órdenes", format_number(len(orders))),
            (
                "Programadas",
                format_number(by_status.get(MaintenanceStatus.PROGRAMADO.value, 0)),
            ),
            (
                "En ejecución",
                format_number(by_status.get(MaintenanceStatus.EN_EJECUCION.value, 0)),
            ),
            (
                "Liquidadas",
                format_number(by_status.get(MaintenanceStatus.LIQUIDADO.value, 0)),
            ),
            ("Costo de repuestos", format_currency(sum(order_parts_total(o) for o in orders))),
        ]
    )

    doc.add_table(
        [
            "OT",
            "Fecha",
            "Estado",
            "Máquina",
            "Clasificación",
            "Descripción",
            "Mecánico",
            "Uds.",
            "Costo",
        ],
        [
            [
                order_code(order),
                _format_datetime(getattr(order, "created_at", None)),
                status_label(getattr(order, "status", None)),
                getattr(_machine_of(order), "code", None) or "—",
                getattr(order, "failure_category_label", None)
                or failure_category_label(getattr(order, "failure_category", None)),
                getattr(order, "description", None) or "—",
                getattr(order, "assigned_mechanic_name", None) or "—",
                format_number(order_units_total(order)),
                format_currency(order_parts_total(order)),
            ]
            for order in orders
        ],
        column_widths=[1.0, 1.2, 1.0, 0.9, 1.3, 2.6, 1.4, 0.6, 1.0],
        align_right=(7, 8),
        align_center=(2,),
        total_row=[
            "TOTAL",
            "",
            "",
            f"{len(orders)} OT",
            "",
            "",
            "",
            format_number(sum(order_units_total(o) for o in orders)),
            format_currency(sum(order_parts_total(o) for o in orders)),
        ],
        empty_message="No hay órdenes de trabajo para los filtros seleccionados.",
    )

    if _has_estimated_costs(orders):
        doc.add_paragraph(
            "Los importes de las órdenes no liquidadas son estimaciones calculadas "
            "con el costo vigente del catálogo: el costo histórico se congela al "
            "liquidar la orden.",
            muted=True,
        )

    return doc.render()


# ---------------------------------------------------------------------------
# Hoja de OT individual
# ---------------------------------------------------------------------------
def render_order_sheet_pdf(order) -> bytes:
    """Hoja de Orden de Trabajo individual, lista para firmar y archivar."""
    machine = _machine_of(order)
    code = order_code(order)

    doc = PdfDocument(
        title=f"Orden de Trabajo {code}",
        subtitle=(
            f"{status_label(getattr(order, 'status', None))} · "
            f"Registrada el {_format_datetime(getattr(order, 'created_at', None))}"
        ),
        document_code=code,
    )

    # --- Ficha del activo y de la intervención ---------------------------
    horometer_unit = getattr(machine, "horometer_unit", None)
    unit_text = getattr(horometer_unit, "value", horometer_unit) or "Horas"

    doc.add_section("Datos del activo")
    doc.add_key_values(
        [
            ("Máquina", getattr(machine, "code", None) or "—"),
            (
                "Marca / Modelo",
                f"{getattr(machine, 'brand', '') or ''} {getattr(machine, 'model', '') or ''}".strip()
                or "—",
            ),
            ("Serial de motor", getattr(machine, "motor_serial", None) or "—"),
            ("Tipo de maquinaria", getattr(machine, "machine_type_name", None) or "—"),
            (
                "Horómetro actual",
                f"{format_number(getattr(machine, 'current_horometer', 0), 1)} {unit_text}",
            ),
            ("Ubicación", getattr(machine, "location", None) or "—"),
        ]
    )

    doc.add_section("Datos de la intervención")
    next_service = getattr(order, "next_service_horometer", None)
    doc.add_key_values(
        [
            ("Estado", status_label(getattr(order, "status", None))),
            (
                "Clasificación de falla",
                getattr(order, "failure_category_label", None)
                or failure_category_label(getattr(order, "failure_category", None)),
            ),
            ("Mecánico asignado", getattr(order, "assigned_mechanic_name", None) or "—"),
            ("Registrada por", getattr(order, "created_by_name", None) or "—"),
            (
                "Próximo servicio",
                f"{format_number(next_service, 1)} {unit_text}" if next_service else "—",
            ),
            ("Última actualización", _format_datetime(getattr(order, "updated_at", None))),
        ]
    )

    # --- Descripción y trabajo realizado ---------------------------------
    doc.add_section("Descripción del servicio / falla")
    doc.add_paragraph(getattr(order, "description", None) or "Sin descripción registrada.")
    doc.add_spacer(4)

    work_performed = getattr(order, "work_performed", None)
    doc.add_section("Trabajo realizado")
    doc.add_paragraph(
        work_performed
        or "Pendiente: se registra al liquidar la orden de trabajo."
    )
    doc.add_spacer(4)

    # --- Detalle de repuestos --------------------------------------------
    parts = getattr(order, "spare_parts", None) or []
    doc.add_section("Repuestos asignados")

    rows = []
    for item in parts:
        part = getattr(item, "spare_part", None)
        quantity = spare_part_quantity(item)
        unit_cost, is_historical = spare_part_unit_cost(item)
        returned = int(getattr(item, "quantity_returned", 0) or 0)
        rows.append(
            [
                getattr(part, "code", None) or "—",
                getattr(part, "name", None) or "—",
                format_number(quantity),
                format_number(returned),
                format_currency(unit_cost) + ("" if is_historical else " *"),
                format_currency(quantity * unit_cost),
            ]
        )

    doc.add_table(
        ["Código", "Repuesto", "Solicitado", "Devuelto", "Costo Unit.", "Subtotal"],
        rows,
        column_widths=[1.0, 3.0, 0.9, 0.8, 1.1, 1.1],
        align_right=(2, 3, 4, 5),
        total_row=[
            "TOTAL",
            f"{len(parts)} referencia(s)",
            format_number(order_units_total(order)),
            "",
            "",
            format_currency(order_parts_total(order)),
        ],
        empty_message="Sin repuestos asignados a esta orden de trabajo.",
    )

    if any(not spare_part_unit_cost(item)[1] for item in parts):
        doc.add_paragraph(
            "* Importe estimado con el costo vigente del catálogo. El costo "
            "histórico se congela al liquidar la orden.",
            muted=True,
        )

    # --- Solvencias asociadas --------------------------------------------
    solvencies = getattr(order, "solvencies", None) or []
    if solvencies:
        doc.add_section("Solvencias de repuestos emitidas")
        doc.add_table(
            ["Folio", "Tipo", "Estado", "Unidades", "Total"],
            [
                [
                    getattr(s, "code", None) or "—",
                    str(getattr(getattr(s, "solvency_type", None), "value", getattr(s, "solvency_type", "")) or "—"),
                    str(getattr(getattr(s, "status", None), "value", getattr(s, "status", "")) or "—"),
                    format_number(getattr(s, "total_units", 0)),
                    format_currency(getattr(s, "total_cost", 0)),
                ]
                for s in solvencies
            ],
            column_widths=[1.2, 1.2, 1.5, 0.9, 1.1],
            align_right=(3, 4),
        )

    doc.add_signature_block(
        ["Mecánico ejecutor", "Supervisor", "Planificador"]
    )

    return doc.render()
