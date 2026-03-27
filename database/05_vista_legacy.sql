-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 05_vista_legacy.sql - Vista de compatibilidad con tabla vieja
-- ============================================================

-- Vista que mapea la estructura normalizada al formato plano
-- de la tabla eventos_empleados original
CREATE OR REPLACE VIEW v_eventos_legacy AS
SELECT
  ee.id,
  s.id                                    AS local_id,
  enc_emp.nombre || ' ' || enc_emp.apellido AS encargado,
  enc.telefono                            AS telefono_encargado,
  e.nombre || ' ' || e.apellido           AS empleado,
  ce.nombre                               AS motivo,
  ee.fecha_inicial,
  ee.fecha_final,
  ee.observacion,
  ee.created_at,
  ee.updated_at,
  ee.estado::TEXT                          AS estado,
  ee.motivo_actualizacion,
  ee.justificado,
  ee.up_calendar,
  ee.google_event_id
FROM eventos_empleados ee
JOIN empleados e ON e.id = ee.empleado_id
JOIN sucursales s ON s.id = ee.sucursal_id
LEFT JOIN encargados enc ON enc.id = ee.encargado_id
LEFT JOIN empleados enc_emp ON enc_emp.id = enc.empleado_id
JOIN categorias_evento ce ON ce.id = ee.categoria_evento_id;

COMMENT ON VIEW v_eventos_legacy IS 'Vista de compatibilidad con la tabla eventos_empleados original (formato plano)';

-- Vista que mapea la tabla empleados normalizada al formato
-- de la tabla empleados_ingresos_egresos original
CREATE OR REPLACE VIEW v_ingresos_egresos_legacy AS
SELECT
  e.id                                    AS row_number,
  e.apellido || ' ' || e.nombre          AS apellido_nombre,
  e.fecha_ingreso,
  e.fecha_egreso,
  d.nombre                               AS sector,
  e.motivo_egreso                         AS motivo,
  e.fecha_induccion_fin::TEXT             AS induccion_15_dias,
  s.ciudad                               AS lugar,
  s.nombre                               AS local_nombre,
  e.nro_vendedor,
  ceg.nombre                             AS categoria_motivo
FROM empleados e
LEFT JOIN sucursales s ON s.id = e.sucursal_id
LEFT JOIN departamentos d ON d.id = e.departamento_id
LEFT JOIN categorias_egreso ceg ON ceg.id = e.categoria_egreso_id;

COMMENT ON VIEW v_ingresos_egresos_legacy IS 'Vista de compatibilidad con la tabla empleados_ingresos_egresos original';
