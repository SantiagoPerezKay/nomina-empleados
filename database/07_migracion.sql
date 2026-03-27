-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 07_migracion.sql - Migracion de datos desde tablas viejas
-- ============================================================
-- IMPORTANTE: Este script asume que las tablas viejas
-- (empleados_ingresos_egresos y eventos_empleados)
-- existen en la misma base de datos o esquema accesible.
-- Ajustar nombres de schema si es necesario.
-- ============================================================

BEGIN;

-- ============================================================
-- PASO 1: Migrar empleados desde empleados_ingresos_egresos
-- ============================================================

-- Extraer nombre y apellido del campo apellido_nombre
-- Formato en tabla vieja: "Apellido Nombre" (ej: "Betiana Castillo")
-- Nota: algunos registros pueden tener formato variado

INSERT INTO empleados (
  nro_vendedor,
  nombre,
  apellido,
  fecha_ingreso,
  fecha_induccion_fin,
  fecha_egreso,
  motivo_egreso,
  categoria_egreso_id,
  activo,
  sucursal_id,
  departamento_id
)
SELECT
  eie.nro_vendedor,

  -- Extraer nombre (segunda palabra en adelante)
  CASE
    WHEN POSITION(' ' IN TRIM(eie.apellido_nombre)) > 0
    THEN TRIM(SUBSTRING(TRIM(eie.apellido_nombre) FROM POSITION(' ' IN TRIM(eie.apellido_nombre)) + 1))
    ELSE TRIM(eie.apellido_nombre)
  END AS nombre,

  -- Extraer apellido (primera palabra)
  CASE
    WHEN POSITION(' ' IN TRIM(eie.apellido_nombre)) > 0
    THEN TRIM(SUBSTRING(TRIM(eie.apellido_nombre) FROM 1 FOR POSITION(' ' IN TRIM(eie.apellido_nombre)) - 1))
    ELSE ''
  END AS apellido,

  eie.fecha_ingreso,

  -- Convertir induccion_15_dias texto a DATE
  CASE
    WHEN eie.induccion_15_dias IS NOT NULL AND eie.induccion_15_dias != ''
    THEN eie.induccion_15_dias::DATE
    ELSE NULL
  END AS fecha_induccion_fin,

  eie.fecha_egreso,
  eie.motivo AS motivo_egreso,

  -- Mapear categoria_motivo a categorias_egreso
  (SELECT ce.id FROM categorias_egreso ce
   WHERE ce.nombre = eie.categoria_motivo
   LIMIT 1) AS categoria_egreso_id,

  -- Si tiene fecha_egreso, ya no esta activo
  CASE WHEN eie.fecha_egreso IS NULL THEN TRUE ELSE FALSE END AS activo,

  -- Mapear local_nombre a sucursales
  (SELECT s.id FROM sucursales s
   WHERE LOWER(s.nombre) = LOWER(TRIM(eie.local_nombre))
   LIMIT 1) AS sucursal_id,

  -- Mapear sector a departamentos
  (SELECT d.id FROM departamentos d
   WHERE LOWER(d.nombre) = LOWER(TRIM(eie.sector))
   LIMIT 1) AS departamento_id

FROM empleados_ingresos_egresos eie
ORDER BY eie.row_number;

-- ============================================================
-- PASO 2: Migrar eventos desde eventos_empleados (tabla vieja)
-- ============================================================

-- Primero necesitamos mapear los empleados por nombre
-- ya que la tabla vieja usa texto libre para 'empleado'

INSERT INTO eventos_empleados (
  empleado_id,
  sucursal_id,
  categoria_evento_id,
  fecha_inicial,
  fecha_final,
  observacion,
  estado,
  justificado,
  motivo_actualizacion,
  up_calendar,
  google_event_id,
  created_at,
  updated_at
)
SELECT
  -- Buscar empleado por nombre aproximado
  (SELECT e.id FROM empleados e
   WHERE LOWER(e.nombre || ' ' || e.apellido) = LOWER(TRIM(ev.empleado))
      OR LOWER(e.apellido || ' ' || e.nombre) = LOWER(TRIM(ev.empleado))
   LIMIT 1) AS empleado_id,

  -- Mapear local_id a sucursales (usar el id directo si coincide)
  COALESCE(
    (SELECT s.id FROM sucursales s WHERE s.id = ev.local_id LIMIT 1),
    (SELECT s.id FROM sucursales s WHERE s.nombre = 'Central' LIMIT 1)
  ) AS sucursal_id,

  -- Mapear motivo a categorias_evento
  COALESCE(
    (SELECT ce.id FROM categorias_evento ce
     WHERE LOWER(ce.nombre) LIKE '%' || LOWER(
       CASE
         WHEN ev.motivo ILIKE '%tarde%' THEN 'llegada tarde'
         WHEN ev.motivo ILIKE '%ausencia%' THEN 'ausencia'
         WHEN ev.motivo ILIKE '%no lleg%' THEN 'no llegó'
         WHEN ev.motivo ILIKE '%extra%' THEN 'horas extras'
         WHEN ev.motivo ILIKE '%traslado%' THEN 'traslado'
         WHEN ev.motivo ILIKE '%franco%' THEN 'solicitud de franco'
         WHEN ev.motivo ILIKE '%vacacion%' THEN 'solicitud de vacaciones'
         WHEN ev.motivo ILIKE '%compensat%' THEN 'día compensatorio'
         WHEN ev.motivo ILIKE '%no realiz%' THEN 'no realizó tareas'
         WHEN ev.motivo ILIKE '%adelanto%' THEN 'adelanto'
         WHEN ev.motivo ILIKE '%charla%' THEN 'charla de motivación'
         WHEN ev.motivo ILIKE '%salida%' THEN 'salida durante horario'
         ELSE ev.motivo
       END
     ) || '%'
     LIMIT 1),
    -- Fallback: usar la primera categoria
    (SELECT ce.id FROM categorias_evento ce WHERE ce.codigo = 'ausencia' LIMIT 1)
  ) AS categoria_evento_id,

  ev.fecha_inicial,
  ev.fecha_final,
  ev.observacion,

  -- Mapear estado
  CASE
    WHEN ev.estado = 'aprobado' THEN 'aprobado'::estado_evento_enum
    WHEN ev.estado = 'rechazado' THEN 'rechazado'::estado_evento_enum
    WHEN ev.estado = 'actualizado' THEN 'actualizado'::estado_evento_enum
    ELSE 'sin_revisar'::estado_evento_enum
  END AS estado,

  COALESCE(ev.justificado, FALSE),
  ev.motivo_actualizacion,
  COALESCE(ev.up_calendar::BOOLEAN, FALSE),
  ev.google_event_id,
  COALESCE(ev.created_at, NOW()),
  COALESCE(ev.updated_at, NOW())

FROM eventos_empleados_old ev  -- Renombrar tabla vieja antes de migrar
WHERE
  -- Solo migrar eventos que tienen un empleado mapeado
  EXISTS (
    SELECT 1 FROM empleados e
    WHERE LOWER(e.nombre || ' ' || e.apellido) = LOWER(TRIM(ev.empleado))
       OR LOWER(e.apellido || ' ' || e.nombre) = LOWER(TRIM(ev.empleado))
  );

-- ============================================================
-- PASO 3: Reporte de registros no migrados
-- ============================================================

-- Eventos sin empleado mapeado (revisar manualmente)
-- SELECT ev.id, ev.empleado, ev.motivo
-- FROM eventos_empleados_old ev
-- WHERE NOT EXISTS (
--   SELECT 1 FROM empleados e
--   WHERE LOWER(e.nombre || ' ' || e.apellido) = LOWER(TRIM(ev.empleado))
--      OR LOWER(e.apellido || ' ' || e.nombre) = LOWER(TRIM(ev.empleado))
-- );

COMMIT;

-- ============================================================
-- NOTAS DE MIGRACION
-- ============================================================
-- 1. Antes de ejecutar, renombrar la tabla vieja eventos_empleados
--    a eventos_empleados_old:
--    ALTER TABLE eventos_empleados RENAME TO eventos_empleados_old;
--
-- 2. El mapeo de nombres es aproximado. Revisar manualmente los
--    registros no migrados usando la query comentada arriba.
--
-- 3. Los encargados no se migran automaticamente porque en la
--    tabla vieja son texto libre. Crear registros manualmente.
--
-- 4. Los contratos no existian en la tabla vieja. Crearlos
--    manualmente para cada empleado activo.
-- ============================================================
