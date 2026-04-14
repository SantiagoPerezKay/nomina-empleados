-- ============================================================================
-- MIGRACIÓN: Llegadas tarde NO afectan el cálculo de nómina
-- ============================================================================
-- Regla de negocio: las llegadas tarde se registran como eventos pero NO
-- generan descuentos automáticos en la nómina.
--
-- Esta migración:
-- 1. Marca las categorías de llegada tarde con afecta_nomina=false
-- 2. Desactiva el concepto "llegada_tarde_desc" si existe
-- ============================================================================

UPDATE categorias_evento
   SET afecta_nomina = false
 WHERE codigo IN ('llegada_tarde', 'TARDANZA', 'tardanza', 'LLEGADA_TARDE');

UPDATE conceptos_nomina
   SET activo = false
 WHERE codigo IN ('llegada_tarde_desc', 'DESC_TARDE', 'desc_tarde');
