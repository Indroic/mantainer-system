"""Lectura de valores numéricos en las importaciones masivas (spec 4.4).

Regresión del error «invalid literal for int() with base 10: '5.0'»: openpyxl
entrega los números de Excel como ``float``, así que un stock de 5 llega a la
importación como la cadena ``"5.0"`` y el ``int()`` directo abortaba la fila.
"""

import pytest
from src.shared.infrastructure.reporting.excel import (
    parse_decimal_cell,
    parse_int_cell,
)


class TestParseIntCell:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            # El caso que rompía la importación: Excel escribe los enteros con
            # decimal cero.
            ("5.0", 5),
            ("5.00", 5),
            ("0.0", 0),
            ("2019.0", 2019),
            (" 12.0 ", 12),
            ("5", 5),
            (5.0, 5),
            (5, 5),
            ("-3.0", -3),
            # Negativo contable entre paréntesis.
            ("(4.0)", -4),
            # Símbolos de moneda y separadores de miles.
            ("$1.0", 1),
            ("1.234.567", 1234567),
        ],
    )
    def test_acepta_enteros_en_cualquier_formato(self, raw, expected):
        assert parse_int_cell(raw, field="Stock Actual") == expected

    @pytest.mark.parametrize("raw", ["", None, "   "])
    def test_celda_vacia_usa_el_valor_por_defecto(self, raw):
        assert parse_int_cell(raw, field="Stock Mínimo") == 0
        assert parse_int_cell(raw, field="Stock Mínimo", default=7) == 7

    @pytest.mark.parametrize("raw", ["2.5", "1,5", "0.75"])
    def test_rechaza_fracciones_en_voz_alta(self, raw):
        """Una cantidad fraccionaria NO se trunca en silencio.

        Aceptar "2,5 unidades" como 2 falsearía el stock sin avisar; se prefiere
        un error explícito que el Planificador pueda corregir en el archivo.
        """
        with pytest.raises(ValueError, match="número entero"):
            parse_int_cell(raw, field="Stock Actual")

    @pytest.mark.parametrize("raw", ["abc", "-", "N/A", True])
    def test_rechaza_valores_no_numericos(self, raw):
        with pytest.raises(ValueError, match="Stock Actual"):
            parse_int_cell(raw, field="Stock Actual")


class TestParseDecimalCell:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("1250.5", 1250.5),
            ("86500.0", 86500.0),
            (1250.5, 1250.5),
            # Formato inglés: la coma agrupa millares.
            ("1,234.56", 1234.56),
            # Formato español: el punto agrupa y la coma es decimal.
            ("1.234,56", 1234.56),
            ("2,5", 2.5),
            ("$ 1.099,90", 1099.9),
            ("(1.5)", -1.5),
        ],
    )
    def test_normaliza_separadores_y_moneda(self, raw, expected):
        assert parse_decimal_cell(raw, field="Costo Unitario") == pytest.approx(expected)

    @pytest.mark.parametrize("raw", ["", None])
    def test_celda_vacia_usa_el_valor_por_defecto(self, raw):
        assert parse_decimal_cell(raw, field="Costo Unitario") == 0.0

    @pytest.mark.parametrize("raw", ["abc", "$", True])
    def test_rechaza_valores_no_numericos(self, raw):
        with pytest.raises(ValueError, match="Costo Unitario"):
            parse_decimal_cell(raw, field="Costo Unitario")


class TestParseMachineRow:
    """La importación de maquinaria comparte el mismo parser."""

    def _row(self, **overrides) -> dict:
        row = {
            "Código": "EXC-001",
            "Serial de Motor": "MTR-9F82K1",
            "Marca": "Caterpillar",
            "Modelo": "320D",
            # Excel entrega el año como float.
            "Año de Fabricación": "2019.0",
            "Horómetro Actual": "1250.5",
            "Unidad de Horómetro": "Horas",
            "Estado": "ACTIVA",
        }
        row.update(overrides)
        return row

    def test_lee_anio_y_horometro_con_decimales_de_excel(self):
        from src.features.machine.infrastructure.importers import parse_machine_row

        parsed = parse_machine_row(self._row())

        assert parsed["manufacture_year"] == 2019
        assert parsed["current_horometer"] == pytest.approx(1250.5)

    def test_lee_horometro_con_separador_de_miles(self):
        from src.features.machine.infrastructure.importers import parse_machine_row

        parsed = parse_machine_row(self._row(**{"Horómetro Actual": "86,500.75"}))

        assert parsed["current_horometer"] == pytest.approx(86500.75)

    def test_anio_no_numerico_da_un_mensaje_util(self):
        from src.features.machine.infrastructure.importers import parse_machine_row

        with pytest.raises(ValueError, match="Año de Fabricación"):
            parse_machine_row(self._row(**{"Año de Fabricación": "dos mil"}))
