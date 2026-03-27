-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 03_triggers.sql - Triggers para auto-actualizar updated_at
-- ============================================================

-- Funcion generica para actualizar updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas que tienen updated_at
CREATE TRIGGER trg_sucursales_updated
  BEFORE UPDATE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_departamentos_updated
  BEFORE UPDATE ON departamentos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_empleados_updated
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_contratos_updated
  BEFORE UPDATE ON contratos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_turnos_updated
  BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_eventos_empleados_updated
  BEFORE UPDATE ON eventos_empleados
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_nominas_updated
  BEFORE UPDATE ON nominas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
