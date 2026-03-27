-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 01_enums.sql - Tipos enumerados
-- ============================================================

-- Tipos de contrato
CREATE TYPE tipo_contrato_enum AS ENUM ('mensual', 'por_hora');

-- Tipos de periodo de nomina
CREATE TYPE periodo_nomina_enum AS ENUM ('quincenal', 'mensual');

-- Estados de eventos
CREATE TYPE estado_evento_enum AS ENUM ('sin_revisar', 'aprobado', 'rechazado', 'actualizado');

-- Tipos de movimiento en nomina
CREATE TYPE tipo_movimiento_enum AS ENUM ('ingreso', 'deduccion');

-- Categorias de concepto de nomina
CREATE TYPE categoria_concepto_enum AS ENUM (
  'salario_base',
  'horas_extras',
  'bono',
  'comision',
  'aguinaldo',
  'vacaciones',
  'adelanto',
  'ausencia',
  'llegada_tarde',
  'aporte_social',
  'impuesto',
  'otro'
);
