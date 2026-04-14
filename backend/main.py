from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.database import engine
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
    feriados_router,
    periodos_router,
    sucursales_router,
    turnos_router,
)

# ── Migraciones idempotentes al arranque ──────────────────────────────────────
# Aplicar cambios de schema que no están cubiertos por una herramienta de
# migraciones formal (alembic). Todas las sentencias deben ser idempotentes.
STARTUP_MIGRATIONS = [
    # Trazabilidad de usuario creador de eventos
    """ALTER TABLE eventos_empleados
       ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES usuarios(id)""",
    """CREATE INDEX IF NOT EXISTS idx_eventos_created_by
       ON eventos_empleados(created_by_id)""",
    # Categoría "Llamada de atención"
    """INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina, activo)
       VALUES ('LLAMADA_ATENCION', 'Llamada de atención', false, false, true)
       ON CONFLICT (codigo) DO NOTHING""",
    # Llegadas tarde no afectan nómina (regla de negocio)
    """UPDATE categorias_evento
          SET afecta_nomina = false
        WHERE codigo IN ('llegada_tarde', 'TARDANZA', 'tardanza', 'LLEGADA_TARDE')""",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        for sql in STARTUP_MIGRATIONS:
            try:
                await conn.execute(text(sql))
            except Exception as e:
                print(f"[migration] skipped: {e}")
    yield


app = FastAPI(
    title="Nómina API",
    description="API REST para gestión de empleados y liquidación de nóminas",
    version="1.0.0",
    lifespan=lifespan,
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
app.include_router(feriados_router, prefix="/api")


@app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
