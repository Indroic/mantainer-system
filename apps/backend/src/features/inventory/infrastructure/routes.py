import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import require_roles
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
from src.features.user.domain.entities import UserRole
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
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
) -> SparePartResponse:
    """Registra una nueva pieza o repuesto en el inventario.

    Restringido a Administradores y Supervisores.
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
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
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
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
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
    dependencies=[Depends(require_roles([UserRole.ADMINISTRADOR]))],
)
async def export_spare_parts_csv(
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
):
    """Exporta el catálogo completo de repuestos como archivo CSV en español.

    Restringido al rol Administrador.
    """
    query_dto = QueryRequestDTO(limit=10000, offset=0, filters=[])
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    result = await use_case.execute(query_dto)

    output = io.StringIO()
    # Columnas en español según lo solicitado
    fieldnames = [
        "Código", "Nombre", "Número de Parte", "Código Interno",
        "Unidad de Medida", "Stock Actual", "Stock Mínimo",
        "Costo Unitario", "Costo USD",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for sp in result.items:
        writer.writerow({
            "Código": sp.code,
            "Nombre": sp.name,
            "Número de Parte": getattr(sp, 'part_number', '') or '',
            "Código Interno": getattr(sp, 'internal_code', '') or '',
            "Unidad de Medida": getattr(sp, 'unit_of_measure', '') or '',
            "Stock Actual": sp.stock_current,
            "Stock Mínimo": sp.stock_minimum,
            "Costo Unitario": sp.unit_cost,
            "Costo USD": getattr(sp, 'unit_cost_usd', '') or '',
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=repuestos_sgmm.csv"},
    )


@router.post(
    "/import",
    status_code=status.HTTP_201_CREATED,
)
async def import_spare_parts_csv(
    file: UploadFile = File(...),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR])),
):
    """Importación masiva de repuestos desde archivo CSV con la plantilla estándar en español.

    Restringido al rol Administrador. Las columnas esperadas son las mismas que
    las del archivo de exportación generado por este sistema.
    """
    content = await file.read()
    decoded = content.decode("utf-8-sig")  # utf-8-sig maneja el BOM de Excel
    reader = csv.DictReader(io.StringIO(decoded))

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

            unit_cost_raw = row.get("Costo Unitario", "0").strip()
            unit_cost = float(unit_cost_raw) if unit_cost_raw else 0.0
            stock_min_raw = row.get("Stock Mínimo", "0").strip()
            stock_min = int(stock_min_raw) if stock_min_raw else 0
            stock_cur_raw = row.get("Stock Actual", "0").strip()
            stock_cur = int(stock_cur_raw) if stock_cur_raw else 0
            usd_raw = row.get("Costo USD", "").strip()
            unit_cost_usd = float(usd_raw) if usd_raw else None

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
    current_user: UserMetadataResponse = Depends(require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])),
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
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
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
            require_roles(
                [UserRole.ADMINISTRADOR, UserRole.SUPERVISOR, UserRole.MECANICO]
            )
        )
    ],
)
async def get_spare_parts(
    search: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> list[SparePartResponse]:
    """Obtiene la lista de todas las piezas del inventario, opcionalmente filtradas por término de búsqueda."""
    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        search=search,
        search_fields=["code", "name"],
        filters=[]
    )
    repo = SparePartRepository(uow)
    use_case = QuerySparePartsUseCase(repo)
    result = await use_case.execute(query_dto)
    return [_map_spare_part(sp) for sp in result.items]




