-- ══════════════════════════════════════════════════════
--  RESET COMPLETO — conserva tablas de configuración
-- ══════════════════════════════════════════════════════

-- 1. Borrar en orden (respetar FK)
TRUNCATE TABLE
  nomina_detalle,
  nominas,
  periodos_nomina,
  horas_extras,
  cuenta_corriente,
  eventos_historial,
  eventos_empleados,
  asistencias,
  conceptos_contrato,
  asignaciones_turno,
  encargados,
  contratos,
  empleados
RESTART IDENTITY CASCADE;

-- 2. Borrar usuarios no-superadmin
DELETE FROM usuarios WHERE rol != 'superadmin';