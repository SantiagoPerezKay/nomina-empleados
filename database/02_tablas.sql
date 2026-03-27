-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 02_tablas.sql - Creacion de todas las tablas
-- ============================================================

-- ============================================================
-- SUCURSALES (reemplaza local_nombre + lugar de tabla vieja)
-- ============================================================
CREATE TABLE sucursales (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  ciudad        VARCHAR(150),
  direccion     TEXT,
  telefono      VARCHAR(30),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEPARTAMENTOS (reemplaza campo 'sector' de tabla vieja)
-- ============================================================
CREATE TABLE departamentos (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIAS DE EGRESO (reemplaza 'categoria_motivo' de tabla vieja)
-- ============================================================
CREATE TABLE categorias_egreso (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(200) NOT NULL,
  tipo          VARCHAR(50) NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN categorias_egreso.tipo IS 'Agrupacion: renuncia, despido, abandono, salud, legal, fin_ciclo, desadecuacion';

-- ============================================================
-- EMPLEADOS (tabla maestra - reemplaza apellido_nombre como texto libre)
-- ============================================================
CREATE TABLE empleados (
  id                  SERIAL PRIMARY KEY,
  nro_vendedor        INTEGER UNIQUE,
  nombre              VARCHAR(200) NOT NULL,
  apellido            VARCHAR(200) NOT NULL,
  documento           VARCHAR(30) UNIQUE,
  email               VARCHAR(200),
  telefono            VARCHAR(30),
  fecha_nacimiento    DATE,
  fecha_ingreso       DATE NOT NULL,
  fecha_induccion_fin DATE,
  fecha_egreso        DATE,
  motivo_egreso       TEXT,
  categoria_egreso_id INTEGER REFERENCES categorias_egreso(id),
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  sucursal_id         INTEGER REFERENCES sucursales(id),
  departamento_id     INTEGER REFERENCES departamentos(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN empleados.nro_vendedor IS 'Codigo interno del empleado (viene de nro_vendedor tabla vieja)';
COMMENT ON COLUMN empleados.fecha_induccion_fin IS 'Fin del periodo de prueba/induccion de 15 dias';
COMMENT ON COLUMN empleados.fecha_egreso IS 'NULL = empleado activo';
COMMENT ON COLUMN empleados.motivo_egreso IS 'Motivo libre de egreso (viene de campo motivo tabla vieja)';

-- ============================================================
-- CONTRATOS (historial de contratos, 1 empleado -> N contratos)
-- ============================================================
CREATE TABLE contratos (
  id              SERIAL PRIMARY KEY,
  empleado_id     INTEGER NOT NULL REFERENCES empleados(id),
  tipo_contrato   tipo_contrato_enum NOT NULL,
  salario_mensual NUMERIC(12,2),
  tarifa_hora     NUMERIC(10,2),
  periodo_nomina  periodo_nomina_enum NOT NULL DEFAULT 'mensual',
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  observacion     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_contrato_salario CHECK (
    (tipo_contrato = 'mensual'  AND salario_mensual IS NOT NULL) OR
    (tipo_contrato = 'por_hora' AND tarifa_hora IS NOT NULL)
  )
);

COMMENT ON COLUMN contratos.fecha_fin IS 'NULL = contrato vigente';
COMMENT ON CONSTRAINT chk_contrato_salario ON contratos IS 'Salario mensual obligatorio si tipo=mensual, tarifa hora obligatoria si tipo=por_hora';

-- ============================================================
-- TURNOS (definicion de horarios)
-- ============================================================
CREATE TABLE turnos (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  hora_entrada    TIME NOT NULL,
  hora_salida     TIME NOT NULL,
  tolerancia_min  INTEGER NOT NULL DEFAULT 10,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN turnos.tolerancia_min IS 'Minutos de gracia antes de considerar llegada tarde';

-- ============================================================
-- ASIGNACIONES DE TURNO (empleado <-> turno, por periodo)
-- ============================================================
CREATE TABLE asignaciones_turno (
  id              SERIAL PRIMARY KEY,
  empleado_id     INTEGER NOT NULL REFERENCES empleados(id),
  turno_id        INTEGER NOT NULL REFERENCES turnos(id),
  sucursal_id     INTEGER NOT NULL REFERENCES sucursales(id),
  fecha_desde     DATE NOT NULL,
  fecha_hasta     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN asignaciones_turno.fecha_hasta IS 'NULL = asignacion vigente';

-- ============================================================
-- ENCARGADOS (asignacion de gerentes/supervisores, por periodo)
-- ============================================================
CREATE TABLE encargados (
  id              SERIAL PRIMARY KEY,
  empleado_id     INTEGER NOT NULL REFERENCES empleados(id),
  sucursal_id     INTEGER NOT NULL REFERENCES sucursales(id),
  telefono        VARCHAR(30),
  fecha_desde     DATE NOT NULL,
  fecha_hasta     DATE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE encargados IS 'Un encargado es un empleado con rol de supervisor. empleado_id apunta al empleado que ES el encargado.';

-- ============================================================
-- CATEGORIAS DE EVENTO (catalogo de tipos de evento)
-- ============================================================
CREATE TABLE categorias_evento (
  id                    SERIAL PRIMARY KEY,
  codigo                VARCHAR(50) UNIQUE NOT NULL,
  nombre                VARCHAR(150) NOT NULL,
  descripcion           TEXT,
  requiere_aprobacion   BOOLEAN NOT NULL DEFAULT TRUE,
  afecta_nomina         BOOLEAN NOT NULL DEFAULT FALSE,
  categoria_padre_id    INTEGER REFERENCES categorias_evento(id),
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN categorias_evento.codigo IS 'Clave interna: llegada_tarde, ausencia, horas_extras, etc.';
COMMENT ON COLUMN categorias_evento.categoria_padre_id IS 'Para subcategorias (jerarquia)';

-- ============================================================
-- EVENTOS DE EMPLEADOS (tabla principal de eventos, normalizada)
-- ============================================================
CREATE TABLE eventos_empleados (
  id                    SERIAL PRIMARY KEY,
  empleado_id           INTEGER NOT NULL REFERENCES empleados(id),
  sucursal_id           INTEGER NOT NULL REFERENCES sucursales(id),
  encargado_id          INTEGER REFERENCES encargados(id),
  categoria_evento_id   INTEGER NOT NULL REFERENCES categorias_evento(id),
  fecha_inicial         TIMESTAMPTZ NOT NULL,
  fecha_final           TIMESTAMPTZ,
  observacion           TEXT,
  estado                estado_evento_enum NOT NULL DEFAULT 'sin_revisar',
  justificado           BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_actualizacion  TEXT,
  up_calendar           BOOLEAN NOT NULL DEFAULT FALSE,
  google_event_id       VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EVENTOS HISTORIAL (audit trail de cambios de estado)
-- ============================================================
CREATE TABLE eventos_historial (
  id              SERIAL PRIMARY KEY,
  evento_id       INTEGER NOT NULL REFERENCES eventos_empleados(id),
  estado_anterior estado_evento_enum,
  estado_nuevo    estado_evento_enum NOT NULL,
  cambiado_por    INTEGER REFERENCES empleados(id),
  motivo          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONCEPTOS DE NOMINA (catalogo de conceptos de pago/deduccion)
-- ============================================================
CREATE TABLE conceptos_nomina (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(50) UNIQUE NOT NULL,
  nombre          VARCHAR(150) NOT NULL,
  tipo            tipo_movimiento_enum NOT NULL,
  categoria       categoria_concepto_enum NOT NULL,
  porcentaje      NUMERIC(6,4),
  monto_fijo      NUMERIC(12,2),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN conceptos_nomina.porcentaje IS 'Si se calcula como porcentaje del salario base (ej: 0.1100 = 11%)';
COMMENT ON COLUMN conceptos_nomina.monto_fijo IS 'Si es un monto fijo por concepto';

-- ============================================================
-- PERIODOS DE NOMINA (instancias de periodos de pago)
-- ============================================================
CREATE TABLE periodos_nomina (
  id              SERIAL PRIMARY KEY,
  tipo            periodo_nomina_enum NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  cerrado         BOOLEAN NOT NULL DEFAULT FALSE,
  cerrado_por     INTEGER REFERENCES empleados(id),
  cerrado_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_periodo UNIQUE (tipo, fecha_inicio, fecha_fin)
);

COMMENT ON COLUMN periodos_nomina.cerrado IS 'Una vez cerrado, no se permiten modificaciones';

-- ============================================================
-- NOMINAS (cabecera - 1 por empleado por periodo)
-- ============================================================
CREATE TABLE nominas (
  id                SERIAL PRIMARY KEY,
  empleado_id       INTEGER NOT NULL REFERENCES empleados(id),
  contrato_id       INTEGER NOT NULL REFERENCES contratos(id),
  periodo_id        INTEGER NOT NULL REFERENCES periodos_nomina(id),
  salario_base      NUMERIC(12,2) NOT NULL,
  total_ingresos    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deducciones NUMERIC(12,2) NOT NULL DEFAULT 0,
  neto_a_pagar      NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacion       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_nomina_empleado_periodo UNIQUE (empleado_id, periodo_id)
);

COMMENT ON COLUMN nominas.salario_base IS 'Snapshot del salario al momento del calculo';
COMMENT ON COLUMN nominas.contrato_id IS 'Snapshot del contrato vigente al momento del calculo';

-- ============================================================
-- NOMINA DETALLE (lineas de la nomina - cada bono/deduccion)
-- ============================================================
CREATE TABLE nomina_detalle (
  id              SERIAL PRIMARY KEY,
  nomina_id       INTEGER NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
  concepto_id     INTEGER NOT NULL REFERENCES conceptos_nomina(id),
  tipo            tipo_movimiento_enum NOT NULL,
  cantidad        NUMERIC(10,2) DEFAULT 1,
  monto_unitario  NUMERIC(12,2),
  monto_total     NUMERIC(12,2) NOT NULL,
  evento_id       INTEGER REFERENCES eventos_empleados(id),
  observacion     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN nomina_detalle.evento_id IS 'Trazabilidad al evento que origino esta linea (ej: horas extras, ausencia)';
COMMENT ON COLUMN nomina_detalle.cantidad IS 'Ej: numero de horas extras';

-- ============================================================
-- AUDIT LOG (log general de auditoria)
-- ============================================================
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  tabla           VARCHAR(100) NOT NULL,
  registro_id     INTEGER NOT NULL,
  accion          VARCHAR(20) NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos    JSONB,
  usuario_id      INTEGER,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN audit_log.accion IS 'INSERT, UPDATE o DELETE';

-- ============================================================
-- ASISTENCIAS (control de fichadas diario)
-- ============================================================
CREATE TABLE asistencias (
  id              SERIAL PRIMARY KEY,
  empleado_id     INTEGER NOT NULL REFERENCES empleados(id),
  turno_id        INTEGER REFERENCES turnos(id),
  fecha           DATE NOT NULL,
  hora_entrada    TIME NOT NULL,
  hora_salida     TIME,
  estado          VARCHAR(50) DEFAULT 'presente',
  observacion     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asistencia_diaria UNIQUE (empleado_id, fecha)
);
