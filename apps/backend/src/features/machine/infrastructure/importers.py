"""Importación y exportación del catálogo de maquinaria (spec 4.4).

Define un único juego de columnas en español que se usa tanto para generar la
plantilla / exportación como para leer el archivo de importación, de modo que el
archivo que el sistema produce siempre se puede volver a subir.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.features.machine.domain.entities import HorometerUnit, MachineStatus
from src.shared.infrastructure.reporting.excel import Column, ExcelWorkbook
from src.shared.infrastructure.reporting.pdf import (
    PdfDocument,
    format_number,
)

# ---------------------------------------------------------------------------
# Definición de columnas
# ---------------------------------------------------------------------------
COL_CODE = "Código"
COL_MOTOR_SERIAL = "Serial de Motor"
COL_BRAND = "Marca"
COL_MODEL = "Modelo"
COL_YEAR = "Año de Fabricación"
COL_HOROMETER = "Horómetro Actual"
COL_HOROMETER_UNIT = "Unidad de Horómetro"
COL_STATUS = "Estado"
COL_LOCATION = "Ubicación"
COL_DESCRIPTION = "Descripción"

MACHINE_COLUMNS: list[Column] = [
    Column(COL_CODE, "text", width=16),
    Column(COL_MOTOR_SERIAL, "text", width=20),
    Column(COL_BRAND, "text", width=18),
    Column(COL_MODEL, "text", width=18),
    Column(COL_YEAR, "integer"),
    Column(COL_HOROMETER, "decimal"),
    Column(COL_HOROMETER_UNIT, "text", width=20),
    Column(COL_STATUS, "text", width=22),
    Column(COL_LOCATION, "text", width=24),
    Column(COL_DESCRIPTION, "text", width=42),
]

#: Instrucciones que se imprimen al pie de la plantilla de importación.
TEMPLATE_INSTRUCTIONS = [
    f"'{COL_CODE}' y '{COL_MOTOR_SERIAL}' son obligatorios y deben ser únicos.",
    f"'{COL_MOTOR_SERIAL}' no puede contener el carácter '@'.",
    f"'{COL_YEAR}' debe ser un año de cuatro dígitos (p. ej. 2021).",
    f"'{COL_HOROMETER_UNIT}' acepta: {', '.join(u.value for u in HorometerUnit)}.",
    f"'{COL_STATUS}' acepta: {', '.join(s.value for s in MachineStatus)}. "
    "Si se deja vacío, la máquina se crea como ACTIVA.",
    "Si el 'Código' ya existe, la fila se actualiza en lugar de crear un duplicado.",
    "Elimine las filas de ejemplo antes de subir el archivo.",
]

EXAMPLE_ROWS = [
    [
        "EXC-001",
        "MTR-9F82K1",
        "Caterpillar",
        "320D",
        2019,
        1250.5,
        HorometerUnit.HORAS.value,
        MachineStatus.ACTIVA.value,
        "Patio Principal",
        "Excavadora hidráulica de oruga",
    ],
    [
        "CAM-014",
        "MTR-4T11B7",
        "Volvo",
        "FMX 480",
        2021,
        86500.0,
        HorometerUnit.KM.value,
        MachineStatus.ACTIVA.value,
        "Ruta Norte",
        "Camión volteo 20 m³",
    ],
]


@dataclass
class ImportRowError:
    row: int
    message: str


@dataclass
class MachineImportResult:
    """Resumen del resultado de una importación masiva."""

    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[ImportRowError] | None = None

    def as_dict(self) -> dict:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "message": (
                f"Importación completada: {self.created} máquina(s) creada(s), "
                f"{self.updated} actualizada(s), {self.skipped} omitida(s)."
            ),
            "errors": [
                f"Fila {e.row}: {e.message}" for e in (self.errors or [])
            ],
        }


# ---------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------
def _machine_row(machine) -> list:
    unit = getattr(machine, "horometer_unit", None)
    status = getattr(machine, "status", None)
    return [
        machine.code,
        machine.motor_serial,
        machine.brand,
        machine.model,
        machine.manufacture_year,
        machine.current_horometer,
        unit.value if hasattr(unit, "value") else (unit or HorometerUnit.HORAS.value),
        status.value if hasattr(status, "value") else (status or ""),
        getattr(machine, "location", None),
        getattr(machine, "description", None),
    ]


def render_machines_xlsx(machines: list) -> bytes:
    """Exporta el catálogo de maquinaria a Excel, listo para reimportar."""
    wb = ExcelWorkbook()
    wb.add_sheet(
        title="Catálogo de Maquinaria Pesada",
        sheet_title="Maquinaria",
        columns=MACHINE_COLUMNS,
        rows=[_machine_row(m) for m in machines],
        subtitle=(
            f"SGMM Portal · {len(machines)} activo(s) · "
            "Este archivo puede editarse y volver a importarse."
        ),
    )
    return wb.render()


def render_machines_template_xlsx() -> bytes:
    """Genera la plantilla de importación con ejemplos e instrucciones."""
    wb = ExcelWorkbook()
    wb.add_template_sheet(
        title="Plantilla de Importación de Maquinaria",
        sheet_title="Plantilla Maquinaria",
        columns=MACHINE_COLUMNS,
        example_rows=EXAMPLE_ROWS,
        instructions=TEMPLATE_INSTRUCTIONS,
    )
    return wb.render()


def render_machines_pdf(machines: list) -> bytes:
    """Exporta el catálogo de maquinaria a PDF (formato horizontal, legible)."""
    doc = PdfDocument(
        title="Catálogo de Maquinaria Pesada",
        subtitle=f"Inventario de activos registrados en el sistema · {len(machines)} máquina(s).",
        orientation="landscape",
    )
    doc.add_table(
        [
            COL_CODE,
            COL_MOTOR_SERIAL,
            COL_BRAND,
            COL_MODEL,
            "Año",
            "Horómetro",
            "Unidad",
            COL_STATUS,
            COL_LOCATION,
        ],
        [
            [
                m.code,
                m.motor_serial,
                m.brand,
                m.model,
                m.manufacture_year,
                format_number(m.current_horometer, 1),
                (
                    getattr(m, "horometer_unit", HorometerUnit.HORAS).value
                    if hasattr(getattr(m, "horometer_unit", None), "value")
                    else getattr(m, "horometer_unit", "Horas")
                ),
                m.status.value if hasattr(m.status, "value") else m.status,
                getattr(m, "location", None) or "—",
            ]
            for m in machines
        ],
        column_widths=[1.1, 1.4, 1.3, 1.3, 0.7, 1.1, 1.0, 1.5, 1.5],
        align_right=(4, 5),
        align_center=(6,),
        empty_message="No hay maquinaria registrada.",
    )
    return doc.render()


# ---------------------------------------------------------------------------
# Importación
# ---------------------------------------------------------------------------
def parse_machine_row(row: dict[str, str]) -> dict:
    """Valida y normaliza una fila del archivo de importación.

    Lanza ``ValueError`` con un mensaje en español si la fila no es utilizable.
    """
    code = (row.get(COL_CODE) or "").strip()
    motor_serial = (row.get(COL_MOTOR_SERIAL) or "").strip()

    if not code:
        raise ValueError(f"'{COL_CODE}' es obligatorio.")
    if not motor_serial:
        raise ValueError(f"'{COL_MOTOR_SERIAL}' es obligatorio.")
    if "@" in motor_serial:
        raise ValueError(f"'{COL_MOTOR_SERIAL}' no puede contener el carácter '@'.")

    raw_year = (row.get(COL_YEAR) or "").strip()
    try:
        manufacture_year = int(float(raw_year)) if raw_year else 0
    except ValueError as exc:
        raise ValueError(
            f"'{COL_YEAR}' debe ser numérico (recibido: '{raw_year}')."
        ) from exc
    if manufacture_year <= 0:
        raise ValueError(f"'{COL_YEAR}' es obligatorio y debe ser un año válido.")

    raw_horometer = (row.get(COL_HOROMETER) or "").strip()
    try:
        current_horometer = float(raw_horometer.replace(",", "")) if raw_horometer else 0.0
    except ValueError as exc:
        raise ValueError(
            f"'{COL_HOROMETER}' debe ser numérico (recibido: '{raw_horometer}')."
        ) from exc

    return {
        "code": code,
        "motor_serial": motor_serial,
        "brand": (row.get(COL_BRAND) or "").strip() or "Sin marca",
        "model": (row.get(COL_MODEL) or "").strip() or "Sin modelo",
        "manufacture_year": manufacture_year,
        "current_horometer": current_horometer,
        "horometer_unit": _parse_horometer_unit(row.get(COL_HOROMETER_UNIT)),
        "status": _parse_status(row.get(COL_STATUS)),
        "location": (row.get(COL_LOCATION) or "").strip() or None,
        "description": (row.get(COL_DESCRIPTION) or "").strip() or None,
    }


def _parse_horometer_unit(raw: str | None) -> HorometerUnit:
    """Acepta la etiqueta en español, el nombre del enum o abreviaturas comunes."""
    token = (raw or "").strip().lower()
    if not token:
        return HorometerUnit.HORAS

    aliases = {
        "horas": HorometerUnit.HORAS,
        "hora": HorometerUnit.HORAS,
        "h": HorometerUnit.HORAS,
        "hrs": HorometerUnit.HORAS,
        "kilometros": HorometerUnit.KM,
        "kilómetros": HorometerUnit.KM,
        "km": HorometerUnit.KM,
        "millas": HorometerUnit.MILLAS,
        "mi": HorometerUnit.MILLAS,
    }
    unit = aliases.get(token)
    if unit is None:
        raise ValueError(
            f"'{COL_HOROMETER_UNIT}' inválida: '{raw}'. "
            f"Valores permitidos: {', '.join(u.value for u in HorometerUnit)}."
        )
    return unit


def _parse_status(raw: str | None) -> MachineStatus:
    """Acepta el valor del enum con o sin guiones bajos y sin distinguir mayúsculas."""
    token = (raw or "").strip().upper().replace(" ", "_")
    if not token:
        return MachineStatus.ACTIVA
    try:
        return MachineStatus(token)
    except ValueError as exc:
        raise ValueError(
            f"'{COL_STATUS}' inválido: '{raw}'. "
            f"Valores permitidos: {', '.join(s.value for s in MachineStatus)}."
        ) from exc
