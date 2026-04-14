-- ============================================================================
-- MIGRACIÓN: Trazabilidad de creación de eventos + categoría "Llamada de atención"
-- ============================================================================
-- 1. Agrega columna created_by_id a eventos_empleados (FK a usuarios)
-- 2. Crea la categoría "LLAMADA_ATENCION" si no existe
-- ============================================================================

-- 1. Columna created_by_id
ALTER TABLE eventos_empleados
  ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES usuarios(id);

CREATE INDEX IF NOT EXISTS idx_eventos_created_by
  ON eventos_empleados(created_by_id);

-- 2. Nueva categoría de evento: Llamada de atención
INSERT INTO categorias_evento (codigo, nombre, requiere_aprobacion, afecta_nomina, activo)
  VALUES ('LLAMADA_ATENCION', 'Llamada de atención', false, false, true)
  ON CONFLICT (codigo) DO NOTHING;
