from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.empleados import router as empleados_router
from app.routers.eventos import router as eventos_router
from app.routers.nominas import router as nominas_router
from app.routers.asistencias import router as asistencias_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reportes import router as reportes_router
from app.routers.general import (
    cat_egreso_router,
    cat_evento_router,
    conceptos_router,
    contratos_router,
    departamentos_router,
    encargados_router,
    periodos_router,
    sucursales_router,
    turnos_router,
)

app = FastAPI(
    title="Nómina API",
    description="API REST para gestión de empleados y liquidación de nóminas",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ajustar en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api")
app.include_router(empleados_router, prefix="/api")
app.include_router(contratos_router, prefix="/api")
app.include_router(sucursales_router, prefix="/api")
app.include_router(departamentos_router, prefix="/api")
app.include_router(turnos_router, prefix="/api")
app.include_router(periodos_router, prefix="/api")
app.include_router(nominas_router, prefix="/api")
app.include_router(asistencias_router, prefix="/api")
app.include_router(eventos_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(reportes_router, prefix="/api")
app.include_router(encargados_router, prefix="/api")
app.include_router(cat_egreso_router, prefix="/api")
app.include_router(cat_evento_router, prefix="/api")
app.include_router(conceptos_router, prefix="/api")


@app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
