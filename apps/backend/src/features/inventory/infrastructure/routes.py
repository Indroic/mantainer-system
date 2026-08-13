import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, status
from fastapi.responses import StreamingResponse
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    CAN_CREATE_SPARE_PARTS,
    CAN_VIEW_INVENTORY,
    PLANNER_ONLY,
    require_roles,
)
from src.features.inventory.application.dtos import (
    CreateSparePartCommand,
    SoftDeleteSparePartCommand,
    SparePartResponse,
    UpdateSparePartPriceCommand,
    UpdateSparePartStockCommand,
)
from src.features.inventory.application.use_cases.create_spare_part import (
    CreateSparePartUseCase,
)
from src.features.inventory.application.use_cases.query_spare_parts import (
    QuerySparePartsUseCase,
)
from src.features.inventory.application.use_cases.soft_delete import (
    SoftDeleteSparePartUseCase,
)
from src.features.inventory.application.use_cases.update_stock import (
    UpdateSparePartStockUseCase,
)
from src.features.inventory.domain.services import InventoryDomainService
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.shared.infrastructure.database.db import get_uow

from src.features.user.application.dtos import UserMetadataResponse

router = APIRouter(prefix="/inventory", tags=["Inventory & Spare Parts"])


def _map_spare_part(sp) -> SparePartResponse:
    """Convierte una entidad SparePart a SparePartResponse, compatiblez con campos opcionales."""
    return SparePartResponse(
        id=sp.id,
        code=sp.code,
        name=sp.name,
        stock_minimum=sp.stock_minimum,
        unit_cost=sp.unit_cost,
        stock_current=sp.stock_current,
        part_number=getattr(sp, 'part_number', None),
        unit_of_measure=getattr(sp, 'unit_of_measure', None),
        internal_code=getattr(sp, 'internal_code', None),
        unit_cost_usd=getattr(sp, 'unit_cost_usd', None),
        created_at=sp.created_at,
        updated_at=sp.updated_at,
        is_active=sp.is_active,
    )


@router.post(
    "/",
    response_model=SparePartResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_spare_part(
    command: CreateSparePartCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(CAN_CREATE_SPARE_PARTS)),
) -> SparePartResponse:
    """Registra una nueva pieza o repuesto en el inventario.

    Permitido al Planificador y a Almacén (spec 2.3: Almacén puede dar de alta
    referencias nuevas, aunque no ajusta stock, precio ni da de baja piezas).
    """
    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)
    use_case = CreateSparePartUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/stock",
    response_model=SparePartResponse,
)
async def update_stock(
    command: UpdateSparePartStockCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(PLANNER_ONLY)),
) -> SparePartResponse:
    """Actualiza manualmente el stock físico disponible de una pieza.

    Restringido a Administradores y Supervisores.
    """
    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)
    use_case = UpdateSparePartStockUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/{spare_part_id}/price",
    response_model=SparePartResponse,
)
async def update_price(
    spare_part_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(PLANNER_ONLY)),
) -> SparePartResponse:
    """Actualiza dinámicamente el precio unitario en USD de un repuesto.

    Restringido a Administradores y Supervisores.
    """
    from uuid import UUID
    new_price = payload.get("new_unit_cost_usd")
    if new_price is None:
        raise HTTPException(status_code=400, detail="Se requiere 'new_unit_cost_usd' en el cuerpo.")
    repo = SparePartRepository(uow)
    spare_part = await repo.get_by_id(UUID(spare_part_id))
    spare_part.unit_cost_usd = float(new_price)
    async with uow:
        await repo.save(spare_part)
        await uow.commit()
    return _map_spare_part(spare_part)


@router.get(
    "/export",
    dependencies=[Depends(require_roles(PLANNER_ONLY))],
)
async def export_spare_parts(
    format: str = "xlsx",
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
):
    """Exporta el catálogo completo de repuestos en Excel, CSV o PDF.

    Restringido al Planificador. El Excel sale con encabezados claros,
    auto-ajuste de columnas y formato de moneda (spec 4.4); el CSV mantiene
    exactamente las mismas columnas para poder reimportarse.
    """
    from src.shared.infrastructure.reporting.excel import Column, ExcelWorkbook
    from src.shared.infrastructure.reporting.pdf import (
        PdfDocument,
        format_currency,
        format_number,
    )

    query_dto = QueryRequestDTO(limit=10000, offset=0, filters=[])
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    result = await use_case.execute(query_dto)
    parts = sorted(result.items, key=lambda sp: (sp.code or ""))

    # Columnas en español, compartidas por los tres formatos.
    headers = [
        "Código", "Nombre", "Número de Parte", "Código Interno",
        "Unidad de Medida", "Stock Actual", "Stock Mínimo",
        "Costo Unitario", "Costo USD",
    ]

    def row_of(sp) -> list:
        return [
            sp.code,
            sp.name,
            getattr(sp, "part_number", None),
            getattr(sp, "internal_code", None),
            getattr(sp, "unit_of_measure", None),
            sp.stock_current,
            sp.stock_minimum,
            sp.unit_cost,
            getattr(sp, "unit_cost_usd", None),
        ]

    normalized = (format or "xlsx").strip().lower()

    if normalized == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for sp in parts:
            writer.writerow(["" if v is None else v for v in row_of(sp)])
        output.seek(0)
        return StreamingResponse(
            # BOM para que Excel abra el CSV respetando los acentos.
            iter(["﻿" + output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=repuestos_sgmm.csv"},
        )

    if normalized == "pdf":
        doc = PdfDocument(
            title="Catálogo de Repuestos",
            subtitle=f"Inventario de piezas de recambio · {len(parts)} referencia(s).",
            orientation="landscape",
        )
        total_value = sum(
            float(sp.stock_current or 0) * float(sp.unit_cost or 0.0) for sp in parts
        )
        doc.add_metric_cards(
            [
                ("Referencias", format_number(len(parts))),
                ("Valor del inventario", format_currency(total_value)),
                (
                    "Bajo mínimo",
                    format_number(
                        sum(1 for sp in parts if sp.stock_current < sp.stock_minimum)
                    ),
                ),
            ]
        )
        doc.add_table(
            ["Código", "Nombre", "N.º de Parte", "Unidad", "Stock", "Mínimo", "Costo Unit."],
            [
                [
                    sp.code,
                    sp.name,
                    getattr(sp, "part_number", None) or "—",
                    getattr(sp, "unit_of_measure", None) or "—",
                    format_number(sp.stock_current),
                    format_number(sp.stock_minimum),
                    format_currency(sp.unit_cost),
                ]
                for sp in parts
            ],
            column_widths=[1.1, 3.0, 1.4, 1.0, 0.8, 0.8, 1.2],
            align_right=(4, 5, 6),
            empty_message="No hay repuestos registrados.",
        )
        return Response(
            content=doc.render(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=repuestos_sgmm.pdf"},
        )

    if normalized not in ("xlsx", "excel"):
        raise HTTPException(
            status_code=400, detail="Formato inválido. Use 'xlsx', 'csv' o 'pdf'."
        )

    wb = ExcelWorkbook()
    wb.add_sheet(
        title="Catálogo de Repuestos",
        sheet_title="Repuestos",
        subtitle=(
            f"SGMM Portal · {len(parts)} referencia(s) · "
            "Este archivo puede editarse y volver a importarse."
        ),
        columns=[
            Column("Código", "text", width=16),
            Column("Nombre", "text", width=38),
            Column("Número de Parte", "text", width=20),
            Column("Código Interno", "text", width=18),
            Column("Unidad de Medida", "text", width=18),
            Column("Stock Actual", "integer"),
            Column("Stock Mínimo", "integer"),
            Column("Costo Unitario", "currency"),
            Column("Costo USD", "currency"),
        ],
        rows=[row_of(sp) for sp in parts],
        total_row=[
            "TOTAL",
            f"{len(parts)} referencia(s)",
            None,
            None,
            None,
            sum(int(sp.stock_current or 0) for sp in parts),
            sum(int(sp.stock_minimum or 0) for sp in parts),
            sum(float(sp.unit_cost or 0.0) for sp in parts),
            sum(float(getattr(sp, "unit_cost_usd", None) or 0.0) for sp in parts),
        ],
    )

    return Response(
        content=wb.render(),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": "attachment; filename=repuestos_sgmm.xlsx"},
    )


@router.post(
    "/import",
    status_code=status.HTTP_201_CREATED,
)
async def import_spare_parts_csv(
    file: UploadFile = File(...),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(PLANNER_ONLY)),
):
    """Importación masiva de repuestos desde Excel (XLSX) o CSV.

    Restringido al Planificador. Las columnas esperadas son las mismas que las
    del archivo de exportación generado por este sistema, por lo que se puede
    exportar, editar y volver a subir.
    """
    from src.shared.infrastructure.reporting.excel import (
        parse_decimal_cell,
        parse_int_cell,
        read_tabular_upload,
    )

    content = await file.read()
    try:
        reader = read_tabular_upload(content, file.filename or "")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo leer el archivo. Use un XLSX o CSV válido. ({exc})",
        ) from exc

    created_count = 0
    errors: list[str] = []

    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)

    for i, row in enumerate(reader, start=2):  # fila 1 = encabezados
        try:
            code = row.get("Código", "").strip()
            name = row.get("Nombre", "").strip()
            if not code or not name:
                errors.append(f"Fila {i}: 'Código' y 'Nombre' son obligatorios.")
                continue

            # Las cantidades y los importes se leen con el parser tolerante:
            # openpyxl entrega los números de Excel como float, así que un stock
            # de 5 llega como "5.0" y un int("5.0") directo reventaba la
            # importación entera con "invalid literal for int()".
            unit_cost = parse_decimal_cell(
                row.get("Costo Unitario"), field="Costo Unitario"
            )
            stock_min = parse_int_cell(row.get("Stock Mínimo"), field="Stock Mínimo")
            stock_cur = parse_int_cell(row.get("Stock Actual"), field="Stock Actual")
            usd_raw = (row.get("Costo USD") or "").strip()
            unit_cost_usd = (
                parse_decimal_cell(usd_raw, field="Costo USD") if usd_raw else None
            )

            command = CreateSparePartCommand(
                code=code,
                name=name,
                stock_minimum=stock_min,
                stock_current=stock_cur,
                unit_cost=unit_cost,
                part_number=row.get("Número de Parte", "").strip() or None,
                unit_of_measure=row.get("Unidad de Medida", "").strip() or None,
                internal_code=row.get("Código Interno", "").strip() or None,
                unit_cost_usd=unit_cost_usd,
                performed_by=current_user.better_auth_user_id,
            )
            use_case = CreateSparePartUseCase(service, uow)
            await use_case.execute(command)
            created_count += 1
        except Exception as exc:
            errors.append(f"Fila {i}: {str(exc)}")

    return {
        "message": f"Importación completada. {created_count} repuestos creados.",
        "errors": errors,
    }


@router.delete(
    "/{spare_part_id}",
    response_model=SparePartResponse,
)
async def soft_delete_spare_part(
    spare_part_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(PLANNER_ONLY)),
) -> SparePartResponse:
    """Realiza la baja lógica (Soft Delete) de una pieza en el inventario.

    Restringido a Administradores y Supervisores.
    """
    repo = SparePartRepository(uow)
    service = InventoryDomainService(repo)
    use_case = SoftDeleteSparePartUseCase(service, uow)

    from uuid import UUID

    command = SoftDeleteSparePartCommand(
        spare_part_id=UUID(spare_part_id),
        performed_by=current_user.better_auth_user_id
    )
    return await use_case.execute(command)


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[
        Depends(
            require_roles(CAN_VIEW_INVENTORY)
        )
    ],
)
async def query_spare_parts(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina los repuestos de manera dinámica.

    Permitido para todos los roles autorizados.
    """
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    return await use_case.execute(query)


@router.get(
    "/",
    response_model=list[SparePartResponse],
    dependencies=[
        Depends(
            require_roles(CAN_VIEW_INVENTORY)
        )
    ],
)
async def get_spare_parts(
    search: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[SparePartResponse]:
    """Obtiene la lista de todas las piezas del inventario, opcionalmente filtradas por término de búsqueda.

    Excluye las piezas dadas de baja lógicamente (is_active=False): sin este
    filtro, un repuesto eliminado seguía apareciendo en el catálogo aunque la
    UI invalidara la caché tras el borrado.
    """
    from hexcore.application.dtos.query import FilterConditionDTO, FilterOperator

    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        search=search,
        search_fields=["code", "name"],
        filters=[
            FilterConditionDTO(field="is_active", operator=FilterOperator.EQ, value=True)
        ]
    )
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    result = await use_case.execute(query_dto)
    return [_map_spare_part(sp) for sp in result.items]




