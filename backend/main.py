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
from app.routers.cuenta_corriente import router as cuenta_corriente_router
from app.routers.integracion import router as integracion_router
from app.routers.general import (
    cat_egreso_router,
    cat_evento_router,
    conceptos_router,
    contratos_router,
    departamentos_router,
    encargados_router,
    feriados_router,
    hs_extras_router,
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
    # Columnas para horas extras en eventos (por si el 08_split_shifts.sql no se aplicó)
    """ALTER TABLE eventos_empleados
       ADD COLUMN IF NOT EXISTS horas_cantidad NUMERIC(6,2) NULL""",
    """ALTER TABLE eventos_empleados
       ADD COLUMN IF NOT EXISTS porcentaje_extra SMALLINT NULL""",
    # Categoría de horas extras — asegurar que HE_EXTRA exista (es la canónica)
    """INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina, activo)
       VALUES ('HE_EXTRA', 'Horas extras', true, true, true)
       ON CONFLICT (codigo) DO NOTHING""",
    # Migrar eventos que usen la categoría duplicada 'horas_extras' a 'HE_EXTRA'
    """UPDATE eventos_empleados
          SET categoria_evento_id = (SELECT id FROM categorias_evento WHERE codigo = 'HE_EXTRA' LIMIT 1)
        WHERE categoria_evento_id IN (SELECT id FROM categorias_evento WHERE codigo = 'horas_extras')
          AND EXISTS (SELECT 1 FROM categorias_evento WHERE codigo = 'HE_EXTRA')""",
    # Eliminar la categoría duplicada 'horas_extras'
    """DELETE FROM categorias_evento WHERE codigo = 'horas_extras'""",
    # Conceptos de nómina para horas extras (idempotente)
    """INSERT INTO conceptos_nomina (codigo, nombre, tipo, categoria, activo)
       VALUES ('horas_extras_50', 'Horas extras 50%', 'ingreso', 'horas_extras', true)
       ON CONFLICT (codigo) DO NOTHING""",
    """INSERT INTO conceptos_nomina (codigo, nombre, tipo, categoria, activo)
       VALUES ('horas_extras_100', 'Horas extras 100%', 'ingreso', 'horas_extras', true)
       ON CONFLICT (codigo) DO NOTHING""",
    # Control de pago en nóminas
    """ALTER TABLE nominas ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT FALSE""",
    """ALTER TABLE nominas ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP NULL""",
    """ALTER TABLE nominas ADD COLUMN IF NOT EXISTS pagado_por_id INTEGER REFERENCES usuarios(id) NULL""",
    """ALTER TABLE nominas ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(12,2) NULL""",
    # Tabla de horas extras directas (sin pasar por eventos)
    """CREATE TABLE IF NOT EXISTS horas_extras (
       id SERIAL PRIMARY KEY,
       empleado_id INTEGER NOT NULL REFERENCES empleados(id),
       fecha DATE NOT NULL,
       horas_cantidad NUMERIC(6,2) NOT NULL,
       porcentaje SMALLINT NOT NULL,
       observacion TEXT,
       created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE INDEX IF NOT EXISTS idx_horas_extras_empleado
       ON horas_extras(empleado_id, fecha)""",
    # Tabla cuenta corriente (compras del empleado a descontar en nómina)
    """CREATE TABLE IF NOT EXISTS cuenta_corriente (
       id SERIAL PRIMARY KEY,
       empleado_id INTEGER NOT NULL REFERENCES empleados(id),
       fecha DATE NOT NULL,
       monto NUMERIC(12,2) NOT NULL,
       descripcion TEXT,
       nomina_id INTEGER REFERENCES nominas(id) NULL,
       created_by_id INTEGER REFERENCES usuarios(id) NULL,
       created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE INDEX IF NOT EXISTS idx_cc_empleado
       ON cuenta_corriente(empleado_id)""",
    """CREATE INDEX IF NOT EXISTS idx_cc_pendiente
       ON cuenta_corriente(empleado_id, nomina_id)""",
    # Columna monto en eventos (para bono fijo y comisión)
    """ALTER TABLE eventos_empleados
       ADD COLUMN IF NOT EXISTS monto NUMERIC(12,2) NULL""",
    # Categorías de comisión y bono
    """INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina, activo)
       VALUES ('COMISION', 'Comisión', true, true, true)
       ON CONFLICT (codigo) DO NOTHING""",
    """INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina, activo)
       VALUES ('BONO', 'Bono', true, true, true)
       ON CONFLICT (codigo) DO NOTHING""",
    # Conceptos de nómina para comisión y bono
    """INSERT INTO conceptos_nomina (codigo, nombre, tipo, categoria, activo)
       VALUES ('comision', 'Comisión', 'ingreso', 'comision', true)
       ON CONFLICT (codigo) DO NOTHING""",
    """INSERT INTO conceptos_nomina (codigo, nombre, tipo, categoria, activo)
       VALUES ('bono', 'Bono', 'ingreso', 'bono', true)
       ON CONFLICT (codigo) DO NOTHING""",
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
app.include_router(cuenta_corriente_router, prefix="/api")
app.include_router(integracion_router, prefix="/api")
app.include_router(encargados_router, prefix="/api")
app.include_router(cat_egreso_router, prefix="/api")
app.include_router(cat_evento_router, prefix="/api")
app.include_router(conceptos_router, prefix="/api")
app.include_router(feriados_router, prefix="/api")
app.include_router(hs_extras_router, prefix="/api")


@app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
