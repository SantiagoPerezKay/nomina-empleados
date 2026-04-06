"""
Corre el migration 08_split_shifts.sql directamente con asyncpg.
Uso:
    python scripts/run_migration.py <DATABASE_URL>
Ejemplo:
    python scripts/run_migration.py \
        "postgresql://postgres:pass@calzalindo-nomina-db:5432/nomina_db"
"""
import asyncio
import sys
import os

try:
    import asyncpg
except ImportError:
    print("ERROR: asyncpg no instalado.")
    sys.exit(1)

SQL = """
-- Tabla de bloques horarios
CREATE TABLE IF NOT EXISTS bloques_horario (
    id          SERIAL PRIMARY KEY,
    turno_id    INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
    orden       SMALLINT NOT NULL DEFAULT 1,
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    UNIQUE(turno_id, orden)
);

-- Tabla de feriados
CREATE TABLE IF NOT EXISTS feriados (
    id      SERIAL PRIMARY KEY,
    fecha   DATE NOT NULL UNIQUE,
    nombre  VARCHAR(200) NOT NULL,
    tipo    VARCHAR(50) NOT NULL DEFAULT 'nacional'
);

-- dia_semana en asignaciones_turno
ALTER TABLE asignaciones_turno
    ADD COLUMN IF NOT EXISTS dia_semana SMALLINT NULL
    CHECK (dia_semana BETWEEN 1 AND 7);

-- horas extras en eventos_empleados
ALTER TABLE eventos_empleados
    ADD COLUMN IF NOT EXISTS horas_cantidad NUMERIC(6,2) NULL;
ALTER TABLE eventos_empleados
    ADD COLUMN IF NOT EXISTS porcentaje_extra SMALLINT NULL
    CHECK (porcentaje_extra IN (50, 100));

-- bloque en asistencias
ALTER TABLE asistencias
    ADD COLUMN IF NOT EXISTS bloque_id INTEGER NULL REFERENCES bloques_horario(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bloques_turno   ON bloques_horario(turno_id);
CREATE INDEX IF NOT EXISTS idx_feriados_fecha  ON feriados(fecha);
CREATE INDEX IF NOT EXISTS idx_asist_bloque    ON asistencias(bloque_id) WHERE bloque_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asigturno_dia   ON asignaciones_turno(empleado_id, dia_semana);
"""


async def main():
    if len(sys.argv) < 2:
        print("Uso: python run_migration.py <DATABASE_URL>")
        sys.exit(1)

    db_url = sys.argv[1].replace("postgresql+asyncpg://", "postgresql://")
    print(f"Conectando a: {db_url[:50]}...")

    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        print(f"ERROR al conectar: {e}")
        sys.exit(1)

    try:
        await conn.execute(SQL)
        print("✅ Migration aplicada exitosamente.")
        print("   - bloques_horario  : OK")
        print("   - feriados         : OK")
        print("   - dia_semana       : OK")
        print("   - horas_cantidad   : OK")
        print("   - porcentaje_extra : OK")
        print("   - bloque_id        : OK")
    except Exception as e:
        print(f"ERROR al ejecutar migration: {e}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
