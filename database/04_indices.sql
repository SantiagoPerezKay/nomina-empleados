-- ============================================================
-- SISTEMA DE NOMINA DE EMPLEADOS
-- 04_indices.sql - Indices optimizados
-- ============================================================

-- EMPLEADOS
CREATE INDEX idx_empleados_activo ON empleados(activo) WHERE activo = TRUE;
CREATE INDEX idx_empleados_sucursal ON empleados(sucursal_id);
CREATE INDEX idx_empleados_departamento ON empleados(departamento_id);
CREATE INDEX idx_empleados_documento ON empleados(documento);
CREATE INDEX idx_empleados_nro_vendedor ON empleados(nro_vendedor);
CREATE INDEX idx_empleados_categoria_egreso ON empleados(categoria_egreso_id);

-- CONTRATOS
CREATE INDEX idx_contratos_empleado ON contratos(empleado_id);
CREATE INDEX idx_contratos_activo ON contratos(empleado_id, activo) WHERE activo = TRUE;
CREATE INDEX idx_contratos_fechas ON contratos(fecha_inicio, fecha_fin);

-- ASIGNACIONES TURNO
CREATE INDEX idx_asig_turno_empleado ON asignaciones_turno(empleado_id);
CREATE INDEX idx_asig_turno_turno ON asignaciones_turno(turno_id);
CREATE INDEX idx_asig_turno_sucursal ON asignaciones_turno(sucursal_id);

-- ENCARGADOS
CREATE INDEX idx_encargados_empleado ON encargados(empleado_id);
CREATE INDEX idx_encargados_sucursal ON encargados(sucursal_id);
CREATE INDEX idx_encargados_activo ON encargados(activo) WHERE activo = TRUE;

-- EVENTOS EMPLEADOS
CREATE INDEX idx_eventos_empleado ON eventos_empleados(empleado_id);
CREATE INDEX idx_eventos_sucursal ON eventos_empleados(sucursal_id);
CREATE INDEX idx_eventos_encargado ON eventos_empleados(encargado_id);
CREATE INDEX idx_eventos_categoria ON eventos_empleados(categoria_evento_id);
CREATE INDEX idx_eventos_fecha ON eventos_empleados(fecha_inicial);
CREATE INDEX idx_eventos_estado ON eventos_empleados(estado);
CREATE INDEX idx_eventos_fecha_rango ON eventos_empleados(fecha_inicial, fecha_final);

-- EVENTOS HISTORIAL
CREATE INDEX idx_eventos_hist_evento ON eventos_historial(evento_id);
CREATE INDEX idx_eventos_hist_fecha ON eventos_historial(created_at);

-- PERIODOS NOMINA
CREATE INDEX idx_periodos_fechas ON periodos_nomina(fecha_inicio, fecha_fin);
CREATE INDEX idx_periodos_abiertos ON periodos_nomina(cerrado) WHERE cerrado = FALSE;

-- NOMINAS
CREATE INDEX idx_nominas_empleado ON nominas(empleado_id);
CREATE INDEX idx_nominas_periodo ON nominas(periodo_id);
CREATE INDEX idx_nominas_contrato ON nominas(contrato_id);

-- NOMINA DETALLE
CREATE INDEX idx_nomina_det_nomina ON nomina_detalle(nomina_id);
CREATE INDEX idx_nomina_det_concepto ON nomina_detalle(concepto_id);
CREATE INDEX idx_nomina_det_evento ON nomina_detalle(evento_id);

-- AUDIT LOG
CREATE INDEX idx_audit_tabla ON audit_log(tabla, registro_id);
CREATE INDEX idx_audit_fecha ON audit_log(created_at);
CREATE INDEX idx_audit_usuario ON audit_log(usuario_id);
