"""Filtros de la Bitácora de Auditoría Forense.

Regresión: los desplegables de la bitácora ofrecían `CREATE`, `UPDATE` y
`DELETE`, pero el backend nunca graba `UPDATE` ni `DELETE` a secas (escribe
`UPDATE_STOCK`, `UPDATE_HOROMETER`, `SOFT_DELETE`, `LIQUIDATE`…), así que esos
filtros no devolvían jamás un registro. El endpoint de facetas expone los valores
que existen de verdad para que la UI construya el selector con ellos.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from hexcore.application.dtos.query import QueryRequestDTO
from src.features.audit.domain.entities import AuditLog
from src.features.audit.infrastructure.repositories import AuditLogRepository
from src.features.audit.infrastructure.routes import (
    get_audit_log_facets,
    get_audit_logs,
)

#: Muestra representativa de lo que el sistema graba de verdad.
SAMPLE = [
    ("Machine", "CREATE"),
    ("Machine", "UPDATE_HOROMETER"),
    ("Machine", "CHANGE_STATUS"),
    ("Machine", "SOFT_DELETE"),
    ("SparePart", "CREATE"),
    ("SparePart", "UPDATE_STOCK"),
    ("MaintenanceOrder", "CREATE"),
    ("MaintenanceOrder", "LIQUIDATE"),
]


@pytest.fixture
async def seeded_uow(test_uow):
    """Bitácora con una muestra de entidades y operaciones reales."""
    async with test_uow:
        repo = AuditLogRepository(test_uow)
        for entity_name, action in SAMPLE:
            await repo.save(
                AuditLog(
                    entity_name=entity_name,
                    entity_id=uuid4(),
                    action=action,
                    payload='{"campo": "valor"}',
                    performed_by="auth-1",
                )
            )
        await test_uow.commit()
    return test_uow


class TestAuditFilters:
    @pytest.mark.asyncio
    async def test_sin_filtros_devuelve_todo(self, seeded_uow):
        logs = await get_audit_logs(uow=seeded_uow)
        assert len(logs) == len(SAMPLE)

    @pytest.mark.asyncio
    async def test_filtra_por_entidad(self, seeded_uow):
        logs = await get_audit_logs(entity_name="Machine", uow=seeded_uow)

        assert len(logs) == 4
        assert {log.entity_name for log in logs} == {"Machine"}

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "action,expected",
        [
            ("CREATE", 3),
            # Operaciones que el selector antiguo no ofrecía y por tanto no se
            # podían filtrar.
            ("SOFT_DELETE", 1),
            ("UPDATE_STOCK", 1),
            ("UPDATE_HOROMETER", 1),
            ("LIQUIDATE", 1),
            ("CHANGE_STATUS", 1),
        ],
    )
    async def test_filtra_por_operacion_real(self, seeded_uow, action, expected):
        logs = await get_audit_logs(action=action, uow=seeded_uow)

        assert len(logs) == expected
        assert {log.action for log in logs} == {action}

    @pytest.mark.asyncio
    async def test_combina_entidad_y_operacion(self, seeded_uow):
        logs = await get_audit_logs(
            entity_name="SparePart", action="CREATE", uow=seeded_uow
        )

        assert len(logs) == 1
        assert logs[0].entity_name == "SparePart"
        assert logs[0].action == "CREATE"

    @pytest.mark.asyncio
    async def test_el_centinela_all_no_filtra(self, seeded_uow):
        """La UI envía "ALL" para decir "sin filtro"; tomarlo literalmente
        vaciaría la tabla."""
        logs = await get_audit_logs(entity_name="ALL", action="ALL", uow=seeded_uow)

        assert len(logs) == len(SAMPLE)

    @pytest.mark.asyncio
    async def test_busqueda_libre_sobre_la_operacion(self, seeded_uow):
        logs = await get_audit_logs(search="UPDATE", uow=seeded_uow)

        assert len(logs) == 2
        assert {log.action for log in logs} == {"UPDATE_HOROMETER", "UPDATE_STOCK"}

    @pytest.mark.asyncio
    async def test_busqueda_libre_por_id_de_registro(self, seeded_uow):
        todos = await get_audit_logs(uow=seeded_uow)
        objetivo = todos[0]

        logs = await get_audit_logs(search=str(objetivo.entity_id), uow=seeded_uow)

        assert [log.id for log in logs] == [objetivo.id]

    @pytest.mark.asyncio
    async def test_filtra_por_autor(self, seeded_uow):
        assert len(await get_audit_logs(performed_by="auth-1", uow=seeded_uow)) == len(
            SAMPLE
        )
        assert await get_audit_logs(performed_by="otro-usuario", uow=seeded_uow) == []

    @pytest.mark.asyncio
    async def test_orden_descendente_por_fecha(self, seeded_uow):
        logs = await get_audit_logs(uow=seeded_uow)

        fechas = [log.created_at for log in logs]
        assert fechas == sorted(fechas, reverse=True)


class TestAuditDateRange:
    @pytest.mark.asyncio
    async def test_rango_que_cubre_hoy_incluye_los_registros(self, seeded_uow):
        hoy = datetime.now(timezone.utc).date().isoformat()

        logs = await get_audit_logs(date_from=hoy, date_to=hoy, uow=seeded_uow)

        # El límite superior se lleva al final del día: "hasta hoy" ha de incluir
        # lo ocurrido hoy mismo.
        assert len(logs) == len(SAMPLE)

    @pytest.mark.asyncio
    async def test_rango_futuro_no_devuelve_nada(self, seeded_uow):
        manana = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()

        assert await get_audit_logs(date_from=manana, uow=seeded_uow) == []

    @pytest.mark.asyncio
    async def test_fecha_invalida_es_un_error_de_peticion(self, seeded_uow):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            await get_audit_logs(date_from="12/08/2026", uow=seeded_uow)

        assert exc.value.status_code == 400


class TestAuditFacets:
    @pytest.mark.asyncio
    async def test_expone_los_valores_presentes_con_su_recuento(self, seeded_uow):
        facets = await get_audit_log_facets(uow=seeded_uow)

        assert facets.total == len(SAMPLE)

        entidades = {item.value: item.count for item in facets.entity_names}
        assert entidades == {"Machine": 4, "SparePart": 2, "MaintenanceOrder": 2}

        acciones = {item.value: item.count for item in facets.actions}
        assert acciones["CREATE"] == 3
        # Las operaciones que el selector escrito a mano omitía.
        assert acciones["SOFT_DELETE"] == 1
        assert acciones["UPDATE_STOCK"] == 1
        assert acciones["LIQUIDATE"] == 1
        # Y NO aparecen las que el sistema nunca graba.
        assert "UPDATE" not in acciones
        assert "DELETE" not in acciones

    @pytest.mark.asyncio
    async def test_cada_faceta_devuelve_resultados_al_filtrar(self, seeded_uow):
        """Invariante que faltaba: toda opción ofrecida debe traer registros."""
        facets = await get_audit_log_facets(uow=seeded_uow)

        for item in facets.actions:
            logs = await get_audit_logs(action=item.value, uow=seeded_uow)
            assert len(logs) == item.count, f"El filtro '{item.value}' no devolvió nada"

        for item in facets.entity_names:
            logs = await get_audit_logs(entity_name=item.value, uow=seeded_uow)
            assert len(logs) == item.count, f"El filtro '{item.value}' no devolvió nada"

    @pytest.mark.asyncio
    async def test_bitacora_vacia_devuelve_facetas_vacias(self, test_uow):
        facets = await get_audit_log_facets(uow=test_uow)

        assert facets.total == 0
        assert facets.entity_names == []
        assert facets.actions == []


class TestAuditPagination:
    @pytest.mark.asyncio
    async def test_respeta_el_limite(self, seeded_uow):
        logs = await get_audit_logs(limit=3, uow=seeded_uow)
        assert len(logs) == 3

    @pytest.mark.asyncio
    async def test_el_limite_se_acota(self, seeded_uow):
        """Un límite disparatado no debe traducirse en una consulta sin techo."""
        query = QueryRequestDTO(limit=5000, offset=0)
        assert query.limit == 5000  # el DTO lo admite…

        logs = await get_audit_logs(limit=999_999, uow=seeded_uow)
        assert len(logs) == len(SAMPLE)  # …y la ruta lo recorta sin fallar
