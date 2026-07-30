"""Constructor de documentos PDF corporativos del SGMM.

Centraliza la identidad visual (encabezado, pie con paginación, estilos de tabla)
para que las Solvencias de Repuestos y las exportaciones de reportes salgan
consistentes, legibles y con formato de moneda correcto.
"""

from __future__ import annotations

import io
from collections.abc import Sequence
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# Paleta corporativa del portal SGMM (índigo/slate), alineada con la web.
BRAND_PRIMARY = colors.HexColor("#4338CA")
BRAND_ACCENT = colors.HexColor("#6366F1")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
HAIRLINE = colors.HexColor("#E2E8F0")
ZEBRA = colors.HexColor("#F8FAFC")
POSITIVE = colors.HexColor("#047857")

APP_NAME = "SGMM Portal"
APP_SUBTITLE = "Sistema de Gestión de Mantenimiento de Maquinaria Pesada"


def format_currency(value: float | int | None, symbol: str = "$") -> str:
    """Formatea moneda con separador de miles y dos decimales."""
    amount = float(value or 0.0)
    return f"{symbol}{amount:,.2f}"


def format_number(value: float | int | None, decimals: int = 0) -> str:
    """Formatea cantidades numéricas con separador de miles."""
    amount = float(value or 0)
    return f"{amount:,.{decimals}f}"


def format_percent(value: float | int | None, decimals: int = 1) -> str:
    return f"{float(value or 0):.{decimals}f}%"


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "SgmmTitle",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=INK,
            spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "SgmmSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=MUTED,
            spaceAfter=10,
        ),
        "section": ParagraphStyle(
            "SgmmSection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=BRAND_PRIMARY,
            spaceBefore=10,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "SgmmBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=INK,
        ),
        "cell": ParagraphStyle(
            "SgmmCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=INK,
        ),
        "cell_header": ParagraphStyle(
            "SgmmCellHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.white,
        ),
        "muted": ParagraphStyle(
            "SgmmMuted",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
        ),
        "right": ParagraphStyle(
            "SgmmRight", parent=base["Normal"], fontName="Helvetica", fontSize=9, alignment=TA_RIGHT
        ),
        "center": ParagraphStyle(
            "SgmmCenter", parent=base["Normal"], fontName="Helvetica", fontSize=9, alignment=TA_CENTER
        ),
    }


class PdfDocument:
    """Documento PDF con encabezado de marca, secciones y tablas profesionales."""

    def __init__(
        self,
        *,
        title: str,
        subtitle: str | None = None,
        document_code: str | None = None,
        orientation: str = "portrait",
    ) -> None:
        self.title = title
        self.subtitle = subtitle
        self.document_code = document_code
        self.styles = _styles()
        self._flowables: list = []
        self._generated_at = datetime.now()

        pagesize = landscape(A4) if orientation == "landscape" else A4
        self._buffer = io.BytesIO()
        self._doc = SimpleDocTemplate(
            self._buffer,
            pagesize=pagesize,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=26 * mm,
            bottomMargin=18 * mm,
            title=title,
            author=APP_NAME,
            subject=subtitle or APP_SUBTITLE,
        )

    # ------------------------------------------------------------------
    # Contenido
    # ------------------------------------------------------------------
    def add_section(self, heading: str) -> None:
        self._flowables.append(Paragraph(heading, self.styles["section"]))

    def add_paragraph(self, text: str, *, muted: bool = False) -> None:
        self._flowables.append(
            Paragraph(text, self.styles["muted" if muted else "body"])
        )

    def add_spacer(self, height: float = 6) -> None:
        self._flowables.append(Spacer(1, height))

    def add_page_break(self) -> None:
        self._flowables.append(PageBreak())

    def add_key_values(self, pairs: Sequence[tuple[str, str]], columns: int = 2) -> None:
        """Bloque de metadatos "etiqueta: valor" en rejilla, para las fichas de cabecera."""
        if not pairs:
            return

        rows: list[list] = []
        chunk: list = []
        for label, value in pairs:
            chunk.append(Paragraph(f"<b>{label}</b><br/>{value or '—'}", self.styles["cell"]))
            if len(chunk) == columns:
                rows.append(chunk)
                chunk = []
        if chunk:
            chunk.extend([""] * (columns - len(chunk)))
            rows.append(chunk)

        available = self._doc.width
        table = Table(rows, colWidths=[available / columns] * columns, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("BACKGROUND", (0, 0), (-1, -1), ZEBRA),
                    ("BOX", (0, 0), (-1, -1), 0.4, HAIRLINE),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, HAIRLINE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        self._flowables.append(table)
        self.add_spacer(6)

    def add_table(
        self,
        headers: Sequence[str],
        rows: Sequence[Sequence[object]],
        *,
        column_widths: Sequence[float] | None = None,
        align_right: Sequence[int] = (),
        align_center: Sequence[int] = (),
        total_row: Sequence[object] | None = None,
        empty_message: str = "Sin registros para los filtros seleccionados.",
    ) -> None:
        """Tabla con encabezado de marca, filas cebra y fila opcional de totales."""
        if not rows:
            self._flowables.append(Paragraph(empty_message, self.styles["muted"]))
            self.add_spacer(6)
            return

        data: list[list] = [
            [Paragraph(str(h), self.styles["cell_header"]) for h in headers]
        ]
        for row in rows:
            data.append(
                [
                    cell
                    if hasattr(cell, "wrap")
                    else Paragraph(str("" if cell is None else cell), self.styles["cell"])
                    for cell in row
                ]
            )

        if total_row is not None:
            data.append(
                [
                    Paragraph(f"<b>{'' if c is None else c}</b>", self.styles["cell"])
                    for c in total_row
                ]
            )

        widths = self._resolve_widths(headers, column_widths)
        table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")

        style = [
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.3, HAIRLINE),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, BRAND_PRIMARY),
        ]

        body_last = len(data) - (2 if total_row is not None else 1)
        for row_index in range(1, body_last + 1):
            if row_index % 2 == 0:
                style.append(("BACKGROUND", (0, row_index), (-1, row_index), ZEBRA))

        for col in align_right:
            style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
        for col in align_center:
            style.append(("ALIGN", (col, 0), (col, -1), "CENTER"))

        if total_row is not None:
            last = len(data) - 1
            style.extend(
                [
                    ("BACKGROUND", (0, last), (-1, last), colors.HexColor("#EEF2FF")),
                    ("LINEABOVE", (0, last), (-1, last), 0.8, BRAND_ACCENT),
                    ("TEXTCOLOR", (0, last), (-1, last), BRAND_PRIMARY),
                ]
            )

        table.setStyle(TableStyle(style))
        self._flowables.append(table)
        self.add_spacer(8)

    def add_metric_cards(self, metrics: Sequence[tuple[str, str]]) -> None:
        """Fila de indicadores destacados (equivalente impreso de las tarjetas del dashboard)."""
        if not metrics:
            return

        cells = [
            Paragraph(
                f'<font size="7" color="#64748B">{label.upper()}</font><br/>'
                f'<font size="13" color="#4338CA"><b>{value}</b></font>',
                self.styles["cell"],
            )
            for label, value in metrics
        ]
        width = self._doc.width / len(cells)
        table = Table([cells], colWidths=[width] * len(cells), hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BACKGROUND", (0, 0), (-1, -1), ZEBRA),
                    ("BOX", (0, 0), (-1, -1), 0.4, HAIRLINE),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, HAIRLINE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        self._flowables.append(table)
        self.add_spacer(8)

    def add_signature_block(self, labels: Sequence[str]) -> None:
        """Líneas de firma (Almacén entrega / Mecánico recibe / Planificador autoriza)."""
        if not labels:
            return

        cells = [
            Paragraph(
                f'<br/><br/>____________________________<br/>'
                f'<font size="7" color="#64748B">{label.upper()}</font>',
                self.styles["center"],
            )
            for label in labels
        ]
        width = self._doc.width / len(cells)
        table = Table([cells], colWidths=[width] * len(cells), hAlign="CENTER")
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 16),
                ]
            )
        )
        self._flowables.append(KeepTogether(table))

    def _resolve_widths(
        self, headers: Sequence[str], column_widths: Sequence[float] | None
    ) -> list[float]:
        """Reparte el ancho disponible respetando pesos relativos si se indican."""
        available = self._doc.width
        if not column_widths:
            return [available / len(headers)] * len(headers)
        total = sum(column_widths) or 1
        return [available * (w / total) for w in column_widths]

    # ------------------------------------------------------------------
    # Render
    # ------------------------------------------------------------------
    def _draw_chrome(self, canvas, doc) -> None:
        """Encabezado de marca y pie con paginación en cada página."""
        canvas.saveState()
        width, height = doc.pagesize

        # Banda superior de marca.
        canvas.setFillColor(BRAND_PRIMARY)
        canvas.rect(0, height - 12 * mm, width, 12 * mm, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(16 * mm, height - 8.2 * mm, APP_NAME)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawRightString(
            width - 16 * mm, height - 8.2 * mm, APP_SUBTITLE
        )

        # Folio del documento bajo la banda.
        if self.document_code:
            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica-Bold", 8)
            canvas.drawRightString(
                width - 16 * mm, height - 18 * mm, self.document_code
            )

        # Pie: fecha de emisión + paginación.
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(
            16 * mm,
            10 * mm,
            f"Generado el {self._generated_at.strftime('%d/%m/%Y %H:%M')}",
        )
        canvas.drawRightString(width - 16 * mm, 10 * mm, f"Página {doc.page}")
        canvas.setStrokeColor(HAIRLINE)
        canvas.setLineWidth(0.4)
        canvas.line(16 * mm, 13 * mm, width - 16 * mm, 13 * mm)
        canvas.restoreState()

    def render(self) -> bytes:
        """Compone el PDF y devuelve sus bytes."""
        story = [
            Paragraph(self.title, self.styles["title"]),
        ]
        if self.subtitle:
            story.append(Paragraph(self.subtitle, self.styles["subtitle"]))
        story.extend(self._flowables)

        self._doc.build(
            story, onFirstPage=self._draw_chrome, onLaterPages=self._draw_chrome
        )
        return self._buffer.getvalue()
