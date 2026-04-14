-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 06_seeds.sql - Datos semilla iniciales
-- ============================================================

-- ============================================================
-- CATEGORIAS DE EGRESO (de la tabla vieja categoria_motivo)
-- ============================================================
INSERT INTO categorias_egreso (nombre, tipo) VALUES
  ('Abandono o Inasistencias',           'abandono'),
  ('Renuncia - Mejora Laboral',          'renuncia'),
  ('Renuncia - Motivos Personales',      'renuncia'),
  ('Renuncia - Conducta o Disciplina',   'renuncia'),
  ('Despido - Bajo Rendimiento',         'despido'),
  ('Despido - Conducta o Disciplina',    'despido'),
  ('Desadecuacion al Puesto / Horario',  'desadecuacion'),
  ('Salud',                              'salud'),
  ('Legal o Conflictivo',                'legal'),
  ('Fin de Ciclo / Refuerzo',            'fin_ciclo');

-- ============================================================
-- DEPARTAMENTOS (de la tabla vieja campo 'sector')
-- ============================================================
INSERT INTO departamentos (nombre) VALUES
  ('Ventas'),
  ('Caja'),
  ('Deposito'),
  ('Diseño'),
  ('Web'),
  ('Repositor'),
  ('Ventas Web'),
  ('Administracion');

-- ============================================================
-- SUCURSALES (de la tabla vieja campos 'lugar' + 'local_nombre')
-- ============================================================
INSERT INTO sucursales (nombre, ciudad) VALUES
  ('Central',   'Venado Tuerto'),
  ('Eva',       'Venado Tuerto'),
  ('Tokyo',     'Venado Tuerto'),
  ('Cuore',     'Venado Tuerto'),
  ('Deposito',  'Venado Tuerto'),
  ('Web',       'Venado Tuerto');

-- ============================================================
-- CATEGORIAS DE EVENTO (de la tabla vieja campo 'motivo')
-- ============================================================
INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina) VALUES
  ('llegada_tarde',         'Llegada tarde',                  TRUE,  FALSE),
  ('ausencia',              'Ausencia',                       TRUE,  TRUE),
  ('no_llego',              'No llegó',                       TRUE,  TRUE),
  ('horas_extras',          'Horas extras',                   TRUE,  TRUE),
  ('traslado',              'Traslado',                       TRUE,  FALSE),
  ('solicitud_franco',      'Solicitud de franco',            TRUE,  FALSE),
  ('solicitud_vacaciones',  'Solicitud de vacaciones',        TRUE,  TRUE),
  ('dia_compensatorio',     'Día compensatorio',              TRUE,  FALSE),
  ('no_realizo_tareas',     'No realizó tareas',              TRUE,  FALSE),
  ('adelanto',              'Adelanto de sueldo',             TRUE,  TRUE),
  ('charla_motivacion',     'Charla de motivación',           FALSE, FALSE),
  ('salida_durante_horario','Salida durante horario laboral', TRUE,  TRUE),
  ('llamada_atencion',      'Llamada de atención',            FALSE, FALSE);

-- ============================================================
-- CONCEPTOS DE NOMINA (conceptos basicos para calculo)
-- ============================================================
INSERT INTO conceptos_nomina (codigo, nombre, tipo, categoria) VALUES
  -- Ingresos
  ('salario_base',     'Salario base',                   'ingreso',   'salario_base'),
  ('horas_extras_50',  'Horas extras 50%',               'ingreso',   'horas_extras'),
  ('horas_extras_100', 'Horas extras 100%',              'ingreso',   'horas_extras'),
  ('bono_asistencia',  'Bono por asistencia perfecta',   'ingreso',   'bono'),
  ('bono_puntualidad', 'Bono por puntualidad',           'ingreso',   'bono'),
  ('aguinaldo',        'Aguinaldo (SAC)',                 'ingreso',   'aguinaldo'),
  ('vacaciones_pago',  'Pago de vacaciones',             'ingreso',   'vacaciones'),

  -- Deducciones
  ('jubilacion',       'Aporte jubilatorio (11%)',        'deduccion', 'aporte_social'),
  ('obra_social',      'Obra social (3%)',                'deduccion', 'aporte_social'),
  ('sindicato',        'Cuota sindical (2%)',             'deduccion', 'aporte_social'),
  ('imp_ganancias',    'Impuesto a las ganancias',       'deduccion', 'impuesto'),
  ('adelanto_desc',    'Descuento por adelanto',          'deduccion', 'adelanto'),
  ('ausencia_desc',    'Descuento por ausencia injust.',  'deduccion', 'ausencia');
-- NOTA: las llegadas tarde NO afectan el cálculo de nómina (por regla de negocio)

-- Actualizar porcentajes para aportes sociales
UPDATE conceptos_nomina SET porcentaje = 0.1100 WHERE codigo = 'jubilacion';
UPDATE conceptos_nomina SET porcentaje = 0.0300 WHERE codigo = 'obra_social';
UPDATE conceptos_nomina SET porcentaje = 0.0200 WHERE codigo = 'sindicato';

-- ============================================================
-- TURNOS (turnos basicos de ejemplo)
-- ============================================================
INSERT INTO turnos (nombre, hora_entrada, hora_salida, tolerancia_min) VALUES
  ('Mañana',     '08:00', '16:00', 10),
  ('Tarde',      '14:00', '22:00', 10),
  ('Noche',      '22:00', '06:00', 10),
  ('Medio dia',  '12:00', '20:00', 10);
