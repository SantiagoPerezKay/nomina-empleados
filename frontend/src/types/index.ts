// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRequest { username: string; password: string }
export interface TokenResponse { access_token: string; token_type: string }
export interface Usuario {
  id: number; username: string; email: string | null
  rol: 'superadmin' | 'admin' | 'rrhh' | 'liquidador' | 'operador'
  activo: boolean
}

// ── Catálogos ─────────────────────────────────────────────────────────────────
export interface Sucursal {
  id: number; nombre: string; ciudad: string | null
  direccion: string | null; telefono: string | null; activo: boolean
}
export interface SucursalCreate { nombre: string; ciudad?: string; direccion?: string; telefono?: string }

export interface Departamento { id: number; nombre: string; activo: boolean }
export interface DepartamentoCreate { nombre: string }

export interface Turno {
  id: number; nombre: string
  hora_entrada: string; hora_salida: string; tolerancia_min: number
}
export interface TurnoCreate { nombre: string; hora_entrada: string; hora_salida: string; tolerancia_min?: number }

export interface CategoriaEgreso { id: number; nombre: string; tipo: string; activo: boolean }
export interface CategoriaEvento {
  id: number; codigo: string; nombre: string
  requiere_aprobacion: boolean; afecta_nomina: boolean
}
export interface ConceptoNomina {
  id: number; codigo: string; nombre: string
  tipo: 'ingreso' | 'deduccion'
  categoria: string
  porcentaje: number | null; monto_fijo: number | null
}
export interface ConceptoNominaCreate {
  codigo: string; nombre: string
  tipo: 'ingreso' | 'deduccion'; categoria: string
  porcentaje?: number; monto_fijo?: number
}

// ── Empleados ─────────────────────────────────────────────────────────────────
export interface Empleado {
  id: number
  nro_vendedor: number | null
  nombre: string; apellido: string
  documento: string | null
  email: string | null; telefono: string | null
  fecha_nacimiento: string | null
  fecha_ingreso: string
  fecha_induccion_fin: string | null
  fecha_egreso: string | null
  motivo_egreso: string | null
  categoria_egreso_id: number | null
  activo: boolean
  en_blanco: boolean
  sucursal_id: number | null; sucursal_nombre?: string | null
  departamento_id: number | null; departamento_nombre?: string | null
}
export interface EmpleadoCreate {
  nombre: string; apellido: string
  fecha_ingreso: string
  nro_vendedor?: number; documento?: string; email?: string; telefono?: string
  fecha_nacimiento?: string; fecha_induccion_fin?: string
  sucursal_id?: number; departamento_id?: number
  en_blanco?: boolean
}
export interface EmpleadoUpdate extends Partial<EmpleadoCreate> {}
export interface EgresoRequest {
  fecha_egreso: string; motivo_egreso?: string; categoria_egreso_id?: number
}

// ── Contratos ─────────────────────────────────────────────────────────────────
export interface Contrato {
  id: number; empleado_id: number
  tipo_contrato: 'mensual' | 'por_hora'
  salario_mensual: number | null; tarifa_hora: number | null
  hs_semanales: number | null
  periodo_nomina: 'quincenal' | 'mensual'
  fecha_inicio: string; fecha_fin: string | null
  activo: boolean; observacion: string | null
}
export interface ContratoCreate {
  empleado_id: number
  tipo_contrato: 'mensual' | 'por_hora'
  salario_mensual?: number; tarifa_hora?: number
  hs_semanales?: number
  periodo_nomina?: 'quincenal' | 'mensual'
  fecha_inicio: string; observacion?: string
}

// ── Eventos ───────────────────────────────────────────────────────────────────
export interface EventoEmpleado {
  id: number; empleado_id: number; sucursal_id: number | null
  encargado_id: number | null; categoria_evento_id: number
  fecha_inicial: string; fecha_final: string | null
  observacion: string | null
  estado: 'sin_revisar' | 'aprobado' | 'rechazado' | 'actualizado'
  justificado: boolean
  motivo_actualizacion: string | null
  horas_cantidad?: number | string | null
  porcentaje_extra?: number | null
  created_by_id?: number | null
  created_at?: string | null
  empleado_nombre?: string; categoria_nombre?: string; sucursal_nombre?: string
  created_by_nombre?: string | null
}
export interface EventoCreate {
  empleado_id: number; categoria_evento_id: number
  fecha_inicial: string; fecha_final?: string
  sucursal_id?: number; encargado_id?: number; observacion?: string
  horas_cantidad?: number
  porcentaje_extra?: number
}
export interface AprobarEventoRequest { justificado?: boolean }
export interface RechazarEventoRequest { motivo: string }
export interface EventoHistorial {
  id: number; evento_id: number
  estado_anterior: string | null; estado_nuevo: string
  cambiado_por: number | null; motivo: string | null
  created_at: string
}

// ── Asistencias ───────────────────────────────────────────────────────────────
export interface Asistencia {
  id: number; empleado_id: number
  fecha: string; hora_entrada: string | null; hora_salida: string | null
  estado: 'presente' | 'tarde' | 'ausente'
  empleado_nombre?: string
}
export interface AsistenciaCreate {
  empleado_id: number; fecha: string
  hora_entrada?: string; hora_salida?: string
  estado?: 'presente' | 'tarde' | 'ausente'
}

// ── Períodos & Nóminas ────────────────────────────────────────────────────────
export interface PeriodoNomina {
  id: number; tipo: 'quincenal' | 'mensual'
  fecha_inicio: string; fecha_fin: string
  cerrado: boolean; cerrado_por: number | null
}
export interface PeriodoCreate {
  tipo: 'quincenal' | 'mensual'
  fecha_inicio: string; fecha_fin: string
}
export interface NominaDetalle {
  id: number; nomina_id: number; concepto_id: number
  tipo: 'ingreso' | 'deduccion'
  cantidad: number; monto_unitario: number; monto_total: number
  evento_id: number | null; concepto_nombre?: string
}
export interface NominaDetalleCreate {
  concepto_id: number; tipo: 'ingreso' | 'deduccion'
  cantidad: number; monto_unitario: number; monto_total: number; evento_id?: number
}
export interface Nomina {
  id: number; empleado_id: number; contrato_id: number; periodo_id: number
  salario_base: number; total_ingresos: number
  total_deducciones: number; neto_a_pagar: number
  empleado_nombre?: string; periodo_label?: string; detalles?: NominaDetalle[]
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardKPIs {
  total_empleados_activos: number
  total_nomina_mes_actual: number
  eventos_pendientes: number
  asistencias_hoy: number
  ausentes_hoy: number
}
export interface NominaPorSucursal {
  sucursal_id: number | null; sucursal_nombre: string | null
  total_empleados: number; total_neto: number
}

// ── Reportes ──────────────────────────────────────────────────────────────────
export interface ReporteNominaEmpleado {
  empleado_id: number; nombre: string; apellido: string
  salario_base: number; total_ingresos: number
  total_deducciones: number; neto_a_pagar: number
}
export interface ReporteAsistencia {
  empleado_id: number; nombre: string; apellido: string
  dias_presentes: number; dias_tarde: number; dias_ausente: number
}
export interface ReporteEgreso {
  empleado_id: number; nombre: string; apellido: string
  fecha_ingreso: string; fecha_egreso: string
  motivo_egreso: string | null; sucursal: string | null
}
export interface ReporteEmpleadoActivo {
  empleado_id: number; nombre: string; apellido: string
  sucursal: string | null; departamento_id: number | null
  fecha_ingreso: string; tipo_contrato: string | null
  salario_mensual: number | null; tarifa_hora: number | null
}
export interface ReporteVacaciones {
  empleado_id: number; nombre: string; apellido: string
  sucursal: string | null; fecha_ingreso: string
  antiguedad_anios: number; dias_correspondientes: number
  dias_tomados: number; dias_pendientes: number
}

// ── Horas Extras ──────────────────────────────────────────────────────────────
export interface HorasExtras {
  id: number
  empleado_id: number
  fecha: string
  horas_cantidad: number
  porcentaje: 50 | 100
  observacion: string | null
  created_at?: string | null
}
export interface HorasExtrasCreate {
  empleado_id: number
  fecha: string
  horas_cantidad: number
  porcentaje: 50 | 100
  observacion?: string
}

// ── Asignaciones de Turno ─────────────────────────────────────────────────────
export interface AsignacionTurno {
  id: number
  empleado_id: number
  turno_id: number
  sucursal_id: number
  fecha_desde: string
  fecha_hasta: string | null
  dia_semana: number | null   // 1=lunes ... 6=sábado, null=todos los días
  turno_nombre?: string
}
export interface AsignacionTurnoCreate {
  empleado_id: number
  turno_id: number
  sucursal_id: number
  fecha_desde: string
  fecha_hasta?: string
  dia_semana?: number | null
}

// ── Encargados ────────────────────────────────────────────────────────────────
export interface Encargado {
  id: number; empleado_id: number; sucursal_id: number
  telefono: string | null; fecha_desde: string; fecha_hasta: string | null
  empleado_nombre?: string; sucursal_nombre?: string
}
export interface EncargadoCreate {
  empleado_id: number; sucursal_id: number
  telefono?: string; fecha_desde: string; fecha_hasta?: string
}
