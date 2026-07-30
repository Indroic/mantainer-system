from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from hexcore.application.dtos.query import QueryRequestDTO, QueryResponseDTO
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.auth.dependencies import (
    CAN_EXECUTE_ORDERS,
    CAN_MANAGE_MACHINES,
    PLANNER_ONLY,
    require_roles,
)
from src.features.user.application.dtos import UserMetadataResponse
from src.features.machine.application.dtos import (
    ChangeMachineStatusCommand,
    CreateMachineCommand,
    MachineResponse,
    SoftDeleteMachineCommand,
    UpdateMachineHorometerCommand,
)
from src.features.machine.application.use_cases.change_status import (
    ChangeMachineStatusUseCase,
)
from src.features.machine.application.use_cases.create_machine import (
    CreateMachineUseCase,
)
from src.features.machine.application.use_cases.query_machines import (
    QueryMachinesUseCase,
)
from src.features.machine.application.use_cases.soft_delete import (
    SoftDeleteMachineUseCase,
)
from src.features.machine.application.use_cases.update_horometer import (
    UpdateMachineHorometerUseCase,
)
from src.features.machine.domain.services import MachineDomainService
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.user.domain.entities import UserRole
from src.shared.infrastructure.database.db import get_uow

router = APIRouter(prefix="/machines", tags=["Machines"])


@router.post(
    "/",
    response_model=MachineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_machine(
    command: CreateMachineCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MachineResponse:
    """Registra una nueva máquina activa en el sistema.

    Restringido a Administradores y Supervisores.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = CreateMachineUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/horometer",
    response_model=MachineResponse,
)
async def update_horometer(
    command: UpdateMachineHorometerCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(
        require_roles(CAN_EXECUTE_ORDERS)
    ),
) -> MachineResponse:
    """Actualiza e incrementa el horómetro de una máquina.

    Permitido para Administradores, Supervisores y Mecánicos.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = UpdateMachineHorometerUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.put(
    "/status",
    response_model=MachineResponse,
)
async def change_status(
    command: ChangeMachineStatusCommand,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MachineResponse:
    """Modifica el estado operativo de una máquina (ej. DADA_DE_BAJA).

    Restringido a Administradores y Supervisores.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = ChangeMachineStatusUseCase(service, uow)
    command.performed_by = current_user.better_auth_user_id
    return await use_case.execute(command)


@router.delete(
    "/{machine_id}",
    response_model=MachineResponse,
)
async def soft_delete_machine(
    machine_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MachineResponse:
    """Realiza la baja lógica (Soft Delete) de una máquina.

    Restringido a Administradores y Supervisores.
    """
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = SoftDeleteMachineUseCase(service, uow)
    # Convertimos el string a UUID en el comando
    from uuid import UUID

    command = SoftDeleteMachineCommand(
        machine_id=UUID(machine_id),
        performed_by=current_user.better_auth_user_id
    )
    return await use_case.execute(command)


@router.post(
    "/query",
    response_model=QueryResponseDTO,
    dependencies=[
        Depends(
            require_roles(CAN_EXECUTE_ORDERS)
        )
    ],
)
async def query_machines(
    query: QueryRequestDTO,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> QueryResponseDTO:
    """Consulta, filtra y pagina maquinaria de manera dinámica.

    Permitido para todos los roles autorizados.
    """
    repo = MachineRepository(uow)
    # El caso de uso Query de HexCore inyecta directamente el repositorio
    use_case = QueryMachinesUseCase(repo)
    return await use_case.execute(query)


# ===========================================================================
# Importación / exportación del catálogo de maquinaria (spec 4.4)
#
# IMPORTANTE: estas rutas se declaran ANTES de `GET /{machine_id}`; si se
# declararan después, FastAPI resolvería `/machines/export` como si `export`
# fuese un ID de máquina.
# ===========================================================================
async def _load_all_machines(uow: SqlAlchemyUnitOfWork) -> list:
    """Catálogo completo de maquinaria activa, ordenado por código."""
    query_dto = QueryRequestDTO(limit=10000, offset=0, filters=[])
    result = await QueryMachinesUseCase(MachineRepository(uow)).execute(query_dto)
    return sorted(result.items, key=lambda m: (m.code or ""))


@router.get(
    "/export",
    dependencies=[Depends(require_roles(CAN_MANAGE_MACHINES))],
)
async def export_machines(
    format: str = "xlsx",
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> Response:
    """Exporta el catálogo completo de maquinaria en Excel, CSV o PDF.

    El archivo Excel usa exactamente las mismas columnas que la plantilla de
    importación, por lo que puede editarse y volver a subirse.
    """
    from src.features.machine.infrastructure.importers import (
        MACHINE_COLUMNS,
        _machine_row,
        render_machines_pdf,
        render_machines_xlsx,
    )

    machines = await _load_all_machines(uow)
    normalized = (format or "xlsx").strip().lower()

    if normalized == "pdf":
        return Response(
            content=render_machines_pdf(machines),
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="maquinaria_sgmm.pdf"'
            },
        )

    if normalized == "csv":
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([c.header for c in MACHINE_COLUMNS])
        for machine in machines:
            writer.writerow(["" if v is None else v for v in _machine_row(machine)])
        # BOM para que Excel abra el CSV con los acentos correctos.
        return Response(
            content="﻿" + output.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="maquinaria_sgmm.csv"'
            },
        )

    if normalized not in ("xlsx", "excel"):
        raise ValueError("Formato inválido. Use 'xlsx', 'csv' o 'pdf'.")

    return Response(
        content=render_machines_xlsx(machines),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": 'attachment; filename="maquinaria_sgmm.xlsx"'
        },
    )


@router.get(
    "/import-template",
    dependencies=[Depends(require_roles(CAN_MANAGE_MACHINES))],
)
async def download_machines_template() -> Response:
    """Descarga la plantilla Excel de importación con ejemplos e instrucciones."""
    from src.features.machine.infrastructure.importers import (
        render_machines_template_xlsx,
    )

    return Response(
        content=render_machines_template_xlsx(),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                'attachment; filename="plantilla_maquinaria_sgmm.xlsx"'
            )
        },
    )


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_machines(
    file: UploadFile = File(...),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(PLANNER_ONLY)),
) -> dict:
    """Importa maquinaria desde la plantilla Excel o un CSV equivalente.

    EXCLUSIVO del Planificador (spec 4.4). Las filas cuyo 'Código' ya existe se
    actualizan; el resto se crean. Los errores se devuelven fila por fila sin
    abortar la importación completa, de modo que un archivo con una fila mala no
    impide cargar las demás.
    """
    from src.features.machine.infrastructure.importers import (
        ImportRowError,
        MachineImportResult,
        parse_machine_row,
    )
    from src.shared.infrastructure.reporting.excel import read_tabular_upload

    content = await file.read()
    try:
        rows = read_tabular_upload(content, file.filename or "")
    except Exception as exc:
        raise ValueError(
            f"No se pudo leer el archivo. Use la plantilla Excel o un CSV válido. ({exc})"
        ) from exc

    result = MachineImportResult(errors=[])
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)

    for index, row in enumerate(rows, start=2):  # fila 1 = encabezados
        try:
            data = parse_machine_row(row)
        except ValueError as exc:
            result.errors.append(ImportRowError(index, str(exc)))
            result.skipped += 1
            continue

        try:
            existing = await repo.get_by_code(data["code"])
            async with uow:
                if existing is not None:
                    # Actualización in-place: no reescribimos el horómetro hacia
                    # atrás, porque el dominio lo prohíbe (es incremental).
                    existing.brand = data["brand"]
                    existing.model = data["model"]
                    existing.manufacture_year = data["manufacture_year"]
                    existing.motor_serial = data["motor_serial"]
                    existing.horometer_unit = data["horometer_unit"]
                    existing.description = data["description"]
                    existing.location = data["location"]
                    if data["current_horometer"] > (existing.current_horometer or 0.0):
                        existing.current_horometer = data["current_horometer"]
                    await repo.save(existing)
                    result.updated += 1
                else:
                    created = await service.create_machine(
                        code=data["code"],
                        motor_serial=data["motor_serial"],
                        brand=data["brand"],
                        model=data["model"],
                        manufacture_year=data["manufacture_year"],
                        current_horometer=data["current_horometer"],
                        horometer_unit=data["horometer_unit"],
                        description=data["description"],
                        location=data["location"],
                    )
                    if data["status"] != created.status:
                        created.change_status(data["status"])
                        await repo.save(created)
                    result.created += 1
                await uow.commit()
        except Exception as exc:
            result.errors.append(ImportRowError(index, str(exc)))
            result.skipped += 1

    return result.as_dict()


@router.get(
    "/",
    response_model=list[MachineResponse],
)
async def get_machines(
    status: str | None = None,
    search: str | None = None,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(
        require_roles(CAN_EXECUTE_ORDERS)
    ),
) -> list[MachineResponse]:
    """Obtiene la lista de todas las máquinas, opcionalmente filtradas por estado o término de búsqueda.

    Los roles no-Administrador jamsás verán máquinas con borrado lógico (is_active=False).
    """
    from hexcore.application.dtos.query import QueryRequestDTO, FilterConditionDTO, FilterOperator

    filters = []
    if status:
        filters.append(FilterConditionDTO(field="status", operator=FilterOperator.EQ, value=status))

    # Filtro RBAC: solo admins pueden ver máquinas dadas de baja (is_active=False)
    if current_user.role != UserRole.PLANIFICADOR:
        filters.append(FilterConditionDTO(field="is_active", operator=FilterOperator.EQ, value=True))

    query_dto = QueryRequestDTO(
        limit=1000,
        offset=0,
        search=search,
        search_fields=["code", "brand", "model"],
        filters=filters
    )
    repo = MachineRepository(uow)
    use_case = QueryMachinesUseCase(repo)
    result = await use_case.execute(query_dto)

    async def _machine_type_name(machine_type_id):
        if not machine_type_id:
            return None
        try:
            from src.features.machine_type.infrastructure.repositories import (
                MachineTypeRepository,
            )
            mt = await MachineTypeRepository(uow).get_by_id(machine_type_id)
            return mt.name
        except Exception:
            return None

    return [
        MachineResponse(
            id=m.id,
            code=m.code,
            motor_serial=m.motor_serial,
            brand=m.brand,
            model=m.model,
            manufacture_year=m.manufacture_year,
            current_horometer=m.current_horometer,
            status=m.status,
            horometer_unit=getattr(m, 'horometer_unit', 'Horas'),
            description=getattr(m, 'description', None),
            location=getattr(m, 'location', None),
            machine_type_id=getattr(m, 'machine_type_id', None),
            machine_type_name=await _machine_type_name(
                getattr(m, 'machine_type_id', None)
            ),
            created_at=m.created_at,
            updated_at=m.updated_at,
            is_active=m.is_active,
        )
        for m in result.items
    ]



@router.get(
    "/{machine_id}",
    response_model=MachineResponse,
    dependencies=[
        Depends(
            require_roles(CAN_EXECUTE_ORDERS)
        )
    ],
)
async def get_machine(
    machine_id: str,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> MachineResponse:
    """Obtiene una máquina específica por su ID."""
    from uuid import UUID
    repo = MachineRepository(uow)
    m = await repo.get_by_id(UUID(machine_id))
    machine_type_name = None
    if getattr(m, 'machine_type_id', None):
        try:
            from src.features.machine_type.infrastructure.repositories import (
                MachineTypeRepository,
            )
            mt = await MachineTypeRepository(uow).get_by_id(m.machine_type_id)
            machine_type_name = mt.name
        except Exception:
            pass

    return MachineResponse(
        id=m.id,
        code=m.code,
        motor_serial=m.motor_serial,
        brand=m.brand,
        model=m.model,
        manufacture_year=m.manufacture_year,
        current_horometer=m.current_horometer,
        status=m.status,
        horometer_unit=getattr(m, 'horometer_unit', 'Horas'),
        description=getattr(m, 'description', None),
        location=getattr(m, 'location', None),
        machine_type_id=getattr(m, 'machine_type_id', None),
        machine_type_name=machine_type_name,
        created_at=m.created_at,
        updated_at=m.updated_at,
        is_active=m.is_active,
    )



@router.put(
    "/{machine_id}/horometer",
    response_model=MachineResponse,
)
async def update_horometer_path(
    machine_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(
        require_roles(CAN_EXECUTE_ORDERS)
    ),
) -> MachineResponse:
    """Actualiza e incrementa el horómetro de una máquina utilizando parámetros en la URL."""
    from uuid import UUID
    
    new_horometer = payload.get("current_horometer") or payload.get("new_horometer")
    if new_horometer is None:
        raise ValueError("Se requiere 'current_horometer' o 'new_horometer' en el cuerpo de la petición.")
        
    command = UpdateMachineHorometerCommand(
        machine_id=UUID(machine_id),
        new_horometer=float(new_horometer),
        performed_by=current_user.better_auth_user_id
    )
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = UpdateMachineHorometerUseCase(service, uow)
    return await use_case.execute(command)


@router.put(
    "/{machine_id}/status",
    response_model=MachineResponse,
)
async def change_status_path(
    machine_id: str,
    payload: dict,
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
    current_user: UserMetadataResponse = Depends(require_roles(CAN_MANAGE_MACHINES)),
) -> MachineResponse:
    """Modifica el estado operativo de una máquina utilizando parámetros en la URL."""
    from uuid import UUID
    from src.features.machine.domain.entities import MachineStatus
    
    command = ChangeMachineStatusCommand(
        machine_id=UUID(machine_id),
        status=MachineStatus(payload["status"]),
        performed_by=current_user.better_auth_user_id
    )
    repo = MachineRepository(uow)
    service = MachineDomainService(repo)
    use_case = ChangeMachineStatusUseCase(service, uow)
    return await use_case.execute(command)

