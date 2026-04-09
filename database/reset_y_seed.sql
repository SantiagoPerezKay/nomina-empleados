-- ============================================================================
-- RESET COMPLETO (mantiene tabla usuarios) + SEED INICIAL
-- Ejecutar con: psql -U postgres -d nomina_db -f reset_y_seed.sql
-- ============================================================================

-- ── 1. TRUNCATE todas las tablas excepto usuarios ──────────────────────────
TRUNCATE TABLE
  nomina_detalle,
  nominas,
  periodos_nomina,
  conceptos_contrato,
  asistencias,
  eventos_historial,
  eventos_empleados,
  asignaciones_turno,
  encargados,
  contratos,
  empleados,
  bloques_horario,
  turnos,
  feriados,
  conceptos_nomina,
  categorias_evento,
  categorias_egreso,
  departamentos,
  sucursales
RESTART IDENTITY CASCADE;

-- ── 2. SUCURSALES ──────────────────────────────────────────────────────────
INSERT INTO sucursales (nombre, ciudad, direccion, telefono, activo) VALUES
  ('Central', 'Venado Tuerto', 'Av. San Martín 1200', '111', true),
  ('Junín', 'Junín', NULL, '222', true);

-- ── 3. DEPARTAMENTOS ──────────────────────────────────────────────────────
INSERT INTO departamentos (nombre, activo) VALUES
  ('Ventas', true),
  ('Compras', true),
  ('Administración', true);

-- ── 4. CATEGORÍAS DE EGRESO ───────────────────────────────────────────────
INSERT INTO categorias_egreso (nombre, tipo, activo) VALUES
  ('Renuncia voluntaria', 'voluntario', true),
  ('Despido con causa', 'involuntario', true),
  ('Despido sin causa', 'involuntario', true),
  ('Mutuo acuerdo', 'voluntario', true),
  ('Fin de contrato', 'voluntario', true),
  ('Jubilación', 'voluntario', true);

-- ── 5. TURNOS ─────────────────────────────────────────────────────────────
INSERT INTO turnos (nombre, hora_entrada, hora_salida, tolerancia_min, activo) VALUES
  ('Mañana', '08:30', '12:30', 10, true),
  ('Tarde', '16:00', '20:00', 10, true),
  ('Completo', '08:30', '17:00', 10, true);

-- ── 6. CATEGORÍAS DE EVENTO ──────────────────────────────────────────────
INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina, activo) VALUES
  ('FALTA_INJ', 'Falta injustificada', true, true, true),
  ('FALTA_JUST', 'Falta justificada', true, false, true),
  ('VACACIONES', 'Vacaciones', true, false, true),
  ('TARDANZA', 'Llegada tarde', false, true, true),
  ('HE_EXTRA', 'Horas extras', true, true, true),
  ('LIC_MED', 'Licencia médica', true, false, true);

-- ── 7. CONCEPTOS DE NÓMINA ──────────────────────────────────────────────
INSERT INTO conceptos_nomina (codigo, nombre, tipo, categoria, porcentaje, monto_fijo, activo) VALUES
  ('SAL_BASE', 'Salario base', 'ingreso', 'salario_base', NULL, NULL, true),
  ('HE_50', 'Horas extras 50%', 'ingreso', 'horas_extras', NULL, NULL, true),
  ('HE_100', 'Horas extras 100%', 'ingreso', 'horas_extras', NULL, NULL, true),
  ('DESC_FALTA', 'Descuento por falta', 'deduccion', 'ausencia', NULL, NULL, true),
  ('APORTE_JUB', 'Aporte jubilación', 'deduccion', 'aporte_social', 11.0000, NULL, true),
  ('APORTE_OS', 'Obra social', 'deduccion', 'aporte_social', 3.0000, NULL, true);

-- ── 8. EMPLEADOS DE EJEMPLO ──────────────────────────────────────────────
INSERT INTO empleados (nombre, apellido, documento, email, telefono, fecha_ingreso, activo, en_blanco, sucursal_id, departamento_id, nro_vendedor) VALUES
  ('Santiago', 'Kay', '30123456', 'santiago@calzalindo.com', '3462111111', '2025-04-06', true, false, 1, 2, 1),
  ('Liliana', 'Kay', '28654321', 'liliana@calzalindo.com', '3462222222', '2023-05-06', true, false, 1, 2, 2),
  ('Test', 'Test', '99999999', 'test@test.com', NULL, '2023-05-06', true, true, 1, 1, 3);

-- ── 9. CONTRATOS ─────────────────────────────────────────────────────────
INSERT INTO contratos (empleado_id, tipo_contrato, salario_mensual, tarifa_hora, hs_semanales, periodo_nomina, fecha_inicio, activo) VALUES
  (1, 'mensual', 800000, NULL, 48, 'mensual', '2025-04-06', true),
  (2, 'mensual', 900000, NULL, 48, 'mensual', '2023-05-06', true),
  (3, 'por_hora', NULL, 5000, 36, 'quincenal', '2023-05-06', true);

-- ── 10. ASIGNACIONES DE TURNO ────────────────────────────────────────────
INSERT INTO asignaciones_turno (empleado_id, turno_id, sucursal_id, fecha_desde) VALUES
  (1, 3, 1, '2025-04-06'),  -- Santiago: turno completo en Central
  (2, 1, 1, '2023-05-06'),  -- Liliana: turno mañana en Central
  (3, 2, 1, '2023-05-06');  -- Test: turno tarde en Central

-- ── 11. CONCEPTOS POR CONTRATO (ejemplo: Test en negro, sin aportes) ────
-- Para empleados "en blanco" (1 y 2): asignar todos los conceptos
INSERT INTO conceptos_contrato (contrato_id, concepto_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),  -- Santiago: todos
  (2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6);  -- Liliana: todos
-- Test (en negro / en_blanco=true): sin aportes, los conceptos se omiten automáticamente por en_blanco

-- ============================================================================
-- FIN DEL SEED
-- ============================================================================
