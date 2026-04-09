"""
Reset completo de la BD (mantiene usuarios) + recrea tablas + ejecuta seed SQL.
Uso:
    python scripts/reset_db.py <DATABASE_URL>

Ejemplo:
    python scripts/reset_db.py "postgresql://postgres:postgres1234@localhost:5432/nomina_db"
"""

import asyncio
import sys
import os

try:
    import asyncpg
except ImportError:
    print("ERROR: asyncpg no instalado. pip install asyncpg")
    sys.exit(1)


SEED_SQL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "database", "reset_y_seed.sql")


async def main():
    if len(sys.argv) < 2:
        print("Uso: python scripts/reset_db.py <DATABASE_URL>")
        sys.exit(1)

    db_url = sys.argv[1].replace("postgresql+asyncpg://", "postgresql://")
    print(f"Conectando a: {db_url[:50]}...")

    conn = await asyncpg.connect(db_url)

    try:
        # 1. Guardar usuarios existentes
        print("Respaldando usuarios...")
        usuarios = await conn.fetch("SELECT * FROM usuarios")
        print(f"  {len(usuarios)} usuarios respaldados")

        # 2. Drop todo y recrear schema
        print("Dropeando schema public...")
        await conn.execute("DROP SCHEMA public CASCADE")
        await conn.execute("CREATE SCHEMA public")
        await conn.execute("GRANT ALL ON SCHEMA public TO public")

        # 3. Recrear tabla usuarios primero
        print("Recreando tabla usuarios...")
        await conn.execute("""
            CREATE TABLE usuarios (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER,
                email VARCHAR UNIQUE NOT NULL,
                password_hash VARCHAR NOT NULL,
                rol VARCHAR DEFAULT 'operador',
                activo BOOLEAN DEFAULT true,
                ultimo_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # 4. Restaurar usuarios
        for u in usuarios:
            await conn.execute("""
                INSERT INTO usuarios (id, empleado_id, email, password_hash, rol, activo, ultimo_login, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, u['id'], u['empleado_id'], u['email'], u['password_hash'],
                u['rol'], u['activo'], u['ultimo_login'], u['created_at'], u['updated_at'])
        # Resetear secuencia
        max_id = max((u['id'] for u in usuarios), default=0)
        await conn.execute(f"SELECT setval('usuarios_id_seq', {max_id}, true)")
        print(f"  {len(usuarios)} usuarios restaurados")

        # 5. Crear todas las demás tablas
        print("Creando tablas del sistema...")
        await conn.execute("""
            CREATE TABLE sucursales (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                ciudad VARCHAR(150),
                direccion TEXT,
                telefono VARCHAR(30),
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE departamentos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE categorias_egreso (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE empleados (
                id SERIAL PRIMARY KEY,
                nro_vendedor INTEGER UNIQUE,
                nombre VARCHAR(200) NOT NULL,
                apellido VARCHAR(200) NOT NULL,
                documento VARCHAR(30) UNIQUE,
                email VARCHAR(200),
                telefono VARCHAR(30),
                fecha_nacimiento DATE,
                fecha_ingreso DATE NOT NULL,
                fecha_induccion_fin DATE,
                fecha_egreso DATE,
                motivo_egreso TEXT,
                categoria_egreso_id INTEGER REFERENCES categorias_egreso(id),
                activo BOOLEAN DEFAULT true,
                en_blanco BOOLEAN DEFAULT false,
                sucursal_id INTEGER REFERENCES sucursales(id),
                departamento_id INTEGER REFERENCES departamentos(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE contratos (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id),
                tipo_contrato VARCHAR(20) NOT NULL,
                salario_mensual NUMERIC(12,2),
                tarifa_hora NUMERIC(10,2),
                hs_semanales INTEGER DEFAULT 48,
                periodo_nomina VARCHAR(20) DEFAULT 'mensual',
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE,
                activo BOOLEAN DEFAULT true,
                observacion TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE turnos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                hora_entrada TIME NOT NULL,
                hora_salida TIME NOT NULL,
                tolerancia_min INTEGER DEFAULT 10,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE bloques_horario (
                id SERIAL PRIMARY KEY,
                turno_id INTEGER NOT NULL REFERENCES turnos(id),
                orden INTEGER NOT NULL DEFAULT 1,
                hora_inicio TIME NOT NULL,
                hora_fin TIME NOT NULL
            );
            CREATE TABLE feriados (
                id SERIAL PRIMARY KEY,
                fecha DATE NOT NULL UNIQUE,
                nombre VARCHAR(200) NOT NULL,
                tipo VARCHAR(50) NOT NULL DEFAULT 'nacional'
            );
            CREATE TABLE asignaciones_turno (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id),
                turno_id INTEGER NOT NULL REFERENCES turnos(id),
                sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
                fecha_desde DATE NOT NULL,
                fecha_hasta DATE,
                dia_semana INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE encargados (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id),
                sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
                telefono VARCHAR(30),
                fecha_desde DATE NOT NULL,
                fecha_hasta DATE,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE categorias_evento (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(50) UNIQUE NOT NULL,
                nombre VARCHAR(150) NOT NULL,
                descripcion TEXT,
                requiere_aprobacion BOOLEAN DEFAULT true,
                afecta_nomina BOOLEAN DEFAULT false,
                categoria_padre_id INTEGER REFERENCES categorias_evento(id),
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE eventos_empleados (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id),
                sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
                encargado_id INTEGER REFERENCES encargados(id),
                categoria_evento_id INTEGER NOT NULL REFERENCES categorias_evento(id),
                fecha_inicial TIMESTAMP NOT NULL,
                fecha_final TIMESTAMP,
                observacion TEXT,
                estado VARCHAR(20) DEFAULT 'sin_revisar',
                justificado BOOLEAN DEFAULT false,
                motivo_actualizacion TEXT,
                up_calendar BOOLEAN DEFAULT false,
                google_event_id VARCHAR(255),
                horas_cantidad NUMERIC(6,2),
                porcentaje_extra INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE eventos_historial (
                id SERIAL PRIMARY KEY,
                evento_id INTEGER NOT NULL REFERENCES eventos_empleados(id),
                estado_anterior VARCHAR(20),
                estado_nuevo VARCHAR(20) NOT NULL,
                cambiado_por INTEGER REFERENCES empleados(id),
                motivo TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE conceptos_nomina (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(50) UNIQUE NOT NULL,
                nombre VARCHAR(150) NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                categoria VARCHAR(50) NOT NULL,
                porcentaje NUMERIC(6,4),
                monto_fijo NUMERIC(12,2),
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE conceptos_contrato (
                id SERIAL PRIMARY KEY,
                contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
                concepto_id INTEGER NOT NULL REFERENCES conceptos_nomina(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_contrato_concepto UNIQUE (contrato_id, concepto_id)
            );
            CREATE TABLE periodos_nomina (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(20) NOT NULL,
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                cerrado BOOLEAN DEFAULT false,
                cerrado_por INTEGER REFERENCES empleados(id),
                cerrado_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE nominas (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id),
                contrato_id INTEGER NOT NULL REFERENCES contratos(id),
                periodo_id INTEGER NOT NULL REFERENCES periodos_nomina(id),
                salario_base NUMERIC(12,2) NOT NULL,
                total_ingresos NUMERIC(12,2) DEFAULT 0,
                total_deducciones NUMERIC(12,2) DEFAULT 0,
                neto_a_pagar NUMERIC(12,2) DEFAULT 0,
                observacion TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE nomina_detalle (
                id SERIAL PRIMARY KEY,
                nomina_id INTEGER NOT NULL REFERENCES nominas(id),
                concepto_id INTEGER NOT NULL REFERENCES conceptos_nomina(id),
                tipo VARCHAR(20) NOT NULL,
                cantidad NUMERIC(10,2) DEFAULT 1,
                monto_unitario NUMERIC(12,2),
                monto_total NUMERIC(12,2) NOT NULL,
                evento_id INTEGER REFERENCES eventos_empleados(id),
                observacion TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE asistencias (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id),
                turno_id INTEGER REFERENCES turnos(id),
                bloque_id INTEGER REFERENCES bloques_horario(id),
                fecha DATE NOT NULL,
                hora_entrada TIME NOT NULL,
                hora_salida TIME,
                estado VARCHAR(50) DEFAULT 'presente',
                observacion TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        print("  Tablas creadas correctamente")

        # 6. Ejecutar seed SQL
        seed_path = os.path.normpath(SEED_SQL_PATH)
        if os.path.exists(seed_path):
            print(f"Ejecutando seed desde: {seed_path}")
            with open(seed_path, 'r', encoding='utf-8') as f:
                seed_sql = f.read()
            await conn.execute(seed_sql)
            print("  Seed ejecutado correctamente")
        else:
            print(f"  ADVERTENCIA: No se encontró {seed_path}, seed no ejecutado")

        # 7. Verificación
        emp_count = await conn.fetchval("SELECT COUNT(*) FROM empleados")
        usr_count = await conn.fetchval("SELECT COUNT(*) FROM usuarios")
        print(f"\nResultado final:")
        print(f"  Usuarios: {usr_count}")
        print(f"  Empleados: {emp_count}")
        print("  RESET COMPLETO OK")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
