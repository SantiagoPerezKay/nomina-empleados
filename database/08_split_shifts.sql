-- ============================================================
-- 08_split_shifts.sql
-- Soporte para horarios cortados, feriados y horas extras
-- ============================================================

-- Tabla de bloques horarios (permite turnos con 2 franjas horarias)
CREATE TABLE IF NOT EXISTS bloques_horario (
    id          SERIAL PRIMARY KEY,
    turno_id    INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
    orden       SMALLINT NOT NULL DEFAULT 1,   -- 1 = primer bloque, 2 = segundo
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    UNIQUE(turno_id, orden)
);

COMMENT ON TABLE bloques_horario IS 'Franjas horarias por turno. Un turno corrido tiene 1 bloque; uno cortado tiene 2.';

-- Tabla de feriados (nacionales, provinciales, empresa)
CREATE TABLE IF NOT EXISTS feriados (
    id      SERIAL PRIMARY KEY,
    fecha   DATE NOT NULL UNIQUE,
    nombre  VARCHAR(200) NOT NULL,
    tipo    VARCHAR(50) NOT NULL DEFAULT 'nacional'   -- nacional | provincial | empresa
);

COMMENT ON TABLE feriados IS 'Registro de días feriados. Las horas trabajadas en feriados se calculan al 100%.';

-- Agregar día de semana a asignaciones_turno
-- NULL = aplica todos los días del rango; 1=lunes ... 6=sábado
ALTER TABLE asignaciones_turno
    ADD COLUMN IF NOT EXISTS dia_semana SMALLINT NULL
    CHECK (dia_semana BETWEEN 1 AND 7);

COMMENT ON COLUMN asignaciones_turno.dia_semana IS '1=lunes, 2=martes, ..., 6=sábado, 7=domingo. NULL = aplica a todos los días del rango.';

-- Horas extras en eventos (para eventos del tipo horas_extras)
ALTER TABLE eventos_empleados
    ADD COLUMN IF NOT EXISTS horas_cantidad NUMERIC(6,2) NULL;
ALTER TABLE eventos_empleados
    ADD COLUMN IF NOT EXISTS porcentaje_extra SMALLINT NULL
    CHECK (porcentaje_extra IN (50, 100));

COMMENT ON COLUMN eventos_empleados.horas_cantidad IS 'Cantidad de horas extras trabajadas (aplica para eventos tipo horas_extras).';
COMMENT ON COLUMN eventos_empleados.porcentaje_extra IS '50 = extras al 50% (días normales), 100 = extras al 100% (feriados/guardia).';

-- Vincular asistencia a bloque (para turnos cortados)
ALTER TABLE asistencias
    ADD COLUMN IF NOT EXISTS bloque_id INTEGER NULL REFERENCES bloques_horario(id);

COMMENT ON COLUMN asistencias.bloque_id IS 'Bloque horario al que corresponde este registro. NULL = turno corrido sin bloques definidos.';

-- Índices de soporte
CREATE INDEX IF NOT EXISTS idx_bloques_turno ON bloques_horario(turno_id);
CREATE INDEX IF NOT EXISTS idx_feriados_fecha ON feriados(fecha);
CREATE INDEX IF NOT EXISTS idx_asist_bloque ON asistencias(bloque_id) WHERE bloque_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asigturno_dia ON asignaciones_turno(empleado_id, dia_semana);
