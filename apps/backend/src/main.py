from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.features.alerts.infrastructure.routes import router as alerts_router
from src.features.audit.infrastructure.routes import router as audit_router
from src.features.inventory.infrastructure.routes import router as inventory_router
from src.features.machine.infrastructure.routes import router as machines_router
from src.features.maintenance.infrastructure.routes import router as maintenance_router
from src.features.reports.infrastructure.routes import router as reports_router
from src.features.user.infrastructure.routes import router as user_router

app = FastAPI(
    title="SGMM API (Sistema de Gestión de Mantenimiento de Maquinaria Pesada)",
    description="API REST del backend desarrollada con HexCore bajo Arquitectura Hexagonal y DDD.",
    version="2.0.0",
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers de las Slices Verticales
app.include_router(user_router, prefix="/api")
app.include_router(machines_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(reports_router, prefix="/api")


# Manejador global de excepciones de negocio (Domain Exceptions / ValueErrors)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Capturamos excepciones comunes de lógica de negocio y retornamos HTTP 400 Bad Request
    excs_to_bad_request = [
        "MachineIsReadOnlyException",
        "MachineInvalidHorometerException",
        "SparePartNegativeStockException",
        "InvalidMaintenanceTransitionException",
        "InvalidMaintenanceOperationException",
        "UserMetadataAlreadyExistsException",
        "UserMetadataNotFoundException",
        "ValueError",
    ]

    exc_class_name = exc.__class__.__name__

    if exc_class_name in excs_to_bad_request or isinstance(exc, ValueError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": exc_class_name,
                "detail": str(exc),
            },
        )

    # Excepción por defecto (500 Internal Server Error)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "detail": f"Un error inesperado ocurrió: {str(exc)}",
        },
    )


@app.get("/")
async def root() -> dict:
    return {
        "status": "online",
        "framework": "HexCore v2.0.x",
        "message": "SGMM Backend API está en línea.",
    }
