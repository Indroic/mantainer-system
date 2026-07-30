"""Render del PDF descargable de la "Solvencia de repuestos" (spec 3.3, punto 3)."""

from __future__ import annotations

from src.features.solvency.application.dtos import SolvencyResponse
from src.shared.infrastructure.reporting.pdf import (
    PdfDocument,
    format_currency,
    format_number,
)

STATUS_LABELS = {
    "PENDIENTE_DESPACHO": "Pendiente de despacho",
    "DESPACHADO": "Despachado",
    "ANULADA": "Anulada",
}


def _status_label(status) -> str:
    """Etiqueta legible del estado, tolerando enum o cadena.

    Los repositorios de HexCore hidratan las entidades sin validación de Pydantic,
    por lo que un campo tipado como enum puede llegar como ``str``. Esta ruta es
    una descarga de usuario: no debe romperse por eso.
    """
    raw = getattr(status, "value", status)
    return STATUS_LABELS.get(str(raw), str(raw))


def render_solvency_pdf(solvency: SolvencyResponse) -> bytes:
    """Genera el comprobante PDF de una Solvencia de Repuestos."""
    is_return = getattr(solvency, "solvency_type", None) == "DEVOLUCION"
    doc = PdfDocument(
        title="Devolución de Repuestos" if is_return else "Solvencia de Repuestos",
        subtitle=(
            "Comprobante de devolución de piezas al inventario"
            if is_return
            else "Comprobante de autorización y despacho de piezas de recambio "
                 "asociado a una Orden de Trabajo."
        ),
        document_code=solvency.code,
    )

    # --- Ficha de cabecera ---------------------------------------------------
    doc.add_section("Datos del documento")
    doc.add_key_values(
        [
            ("Folio interno", solvency.code),
            ("Estado", _status_label(solvency.status)),
            ("Fecha de emisión", solvency.created_at.strftime("%d/%m/%Y %H:%M")),
            ("Emitida por (Planificador)", solvency.issued_by_name or solvency.issued_by),
            ("Maquinaria", solvency.machine_code or str(solvency.machine_id)),
            ("Orden de Trabajo", str(solvency.maintenance_order_id)),
        ]
    )

    if solvency.order_description:
        doc.add_section("Trabajo asociado")
        doc.add_paragraph(solvency.order_description)
        doc.add_spacer(4)

    # --- Detalle de piezas ---------------------------------------------------
    doc.add_section("Repuestos autorizados")
    rows = [
        [
            item.spare_part_code,
            item.spare_part_name,
            format_number(item.quantity),
            format_currency(item.unit_cost),
            format_currency(item.subtotal),
        ]
        for item in solvency.items
    ]
    doc.add_table(
        ["Código", "Descripción del repuesto", "Cantidad", "Costo unitario", "Subtotal"],
        rows,
        column_widths=[1.4, 4.2, 1.1, 1.5, 1.5],
        align_right=(2, 3, 4),
        total_row=[
            "TOTAL",
            f"{len(solvency.items)} línea(s)",
            format_number(solvency.total_units),
            "",
            format_currency(solvency.total_cost),
        ],
        empty_message="La Solvencia no tiene repuestos asociados.",
    )

    if solvency.notes:
        doc.add_section("Observaciones")
        doc.add_paragraph(solvency.notes)

    if solvency.dispatched_by:
        doc.add_section("Despacho")
        doc.add_paragraph(
            f"Piezas entregadas por Almacén: "
            f"{solvency.dispatched_by_name or solvency.dispatched_by}.",
            muted=True,
        )

    # --- Firmas --------------------------------------------------------------
    doc.add_signature_block(
        ["Planificador (autoriza)", "Almacén (entrega)", "Mecánico (recibe)"]
    )

    return doc.render()


def solvency_pdf_filename(solvency: SolvencyResponse) -> str:
    """Nombre de archivo sugerido para la descarga."""
    is_return = getattr(solvency, "solvency_type", None) == "DEVOLUCION"
    prefix = "devolucion" if is_return else "solvencia"
    return f"{prefix}_{solvency.code}.pdf"
