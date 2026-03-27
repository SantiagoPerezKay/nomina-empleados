-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 00_ejecutar_todo.sql - Script maestro de ejecucion
-- ============================================================
-- Ejecutar en orden contra la base de datos PostgreSQL:
--
--   psql -U usuario -d nomina_db -f 01_enums.sql
--   psql -U usuario -d nomina_db -f 02_tablas.sql
--   psql -U usuario -d nomina_db -f 03_triggers.sql
--   psql -U usuario -d nomina_db -f 04_indices.sql
--   psql -U usuario -d nomina_db -f 05_vista_legacy.sql
--   psql -U usuario -d nomina_db -f 06_seeds.sql
--
-- Para migracion de datos (DESPUES de renombrar tablas viejas):
--   psql -U usuario -d nomina_db -f 07_migracion.sql
--
-- O ejecutar todo de una vez:
--   psql -U usuario -d nomina_db -f 00_ejecutar_todo.sql
-- ============================================================

-- Crear la base de datos (descomentar si es necesario):
-- CREATE DATABASE nomina_db WITH ENCODING 'UTF8';
\i 'C:/Users/santy/Desktop/trabajo/nomina/database/01_enums.sql'
\i 'C:/Users/santy/Desktop/trabajo/nomina/database/02_tablas.sql'
\i 'C:/Users/santy/Desktop/trabajo/nomina/database/03_triggers.sql'
\i 'C:/Users/santy/Desktop/trabajo/nomina/database/04_indices.sql'
\i 'C:/Users/santy/Desktop/trabajo/nomina/database/05_vista_legacy.sql'
\i 'C:/Users/santy/Desktop/trabajo/nomina/database/06_seeds.sql'

-- NO incluye migracion automaticamente (requiere preparacion manual)
-- \i 07_migracion.sql
