from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
from datetime import date, datetime, time
from decimal import Decimal


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


# ─── AUTH / USUARIOS ───────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UsuarioCreate(BaseSchema):
    email: str
    password: str
    rol: str = "operador"
    empleado_id: Optional[int] = None
    activo: bool = True

class UsuarioUpdate(BaseSchema):
    email: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None
    empleado_id: Optional[int] = None

class UsuarioOut(BaseSchema):
    id: int
    email: str
    rol: str
    activo: bool
    empleado_id: Optional[int] = None
    ultimo_login: Optional[datetime] = None

class CambiarPasswordRequest(BaseSchema):
    password_actual: str
    password_nuevo: str


# ─── SUCURSALES ────────────────────────────────────────────────────────────────

class SucursalCreate(BaseSchema):
    nombre: str
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

class SucursalUpdate(BaseSchema):
    nombre: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    activo: Optional[bool] = None

class SucursalOut(BaseSchema):
    id: int
    nombre: str
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    activo: bool


# ─── DEPARTAMENTOS ─────────────────────────────────────────────────────────────

class DepartamentoCreate(BaseSchema):
    nombre: str

class DepartamentoUpdate(BaseSchema):
    nombre: Optional[str] = None
    activo: Optional[bool] = None

class DepartamentoOut(BaseSchema):
    id: int
    nombre: str
    activo: bool


# ─── CATEGORIAS EGRESO ─────────────────────────────────────────────────────────

class CategoriaEgresoCreate(BaseSchema):
    nombre: str
    tipo: str

class CategoriaEgresoOut(BaseSchema):
    id: int
    nombre: str
    tipo: str
    activo: bool


# ─── EMPLEADOS ─────────────────────────────────────────────────────────────────

class EmpleadoCreate(BaseSchema):
    nombre: str
    apellido: str
    nro_vendedor: Optional[int] = None
    documento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    fecha_ingreso: date
    fecha_induccion_fin: Optional[date] = None
    sucursal_id: Optional[int] = None
    departamento_id: Optional[int] = None
    en_blanco: bool = False

class EmpleadoUpdate(BaseSchema):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    nro_vendedor: Optional[int] = None
    documento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    fecha_induccion_fin: Optional[date] = None
    sucursal_id: Optional[int] = None
    departamento_id: Optional[int] = None
    en_blanco: Optional[bool] = None

class EmpleadoOut(BaseSchema):
    id: int
    nro_vendedor: Optional[int] = None
    nombre: str
    apellido: str
    documento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    fecha_ingreso: date
    fecha_induccion_fin: Optional[date] = None
    fecha_egreso: Optional[date] = None
    motivo_egreso: Optional[str] = None
    categoria_egreso_id: Optional[int] = None
    activo: bool
    en_blanco: bool = False
    sucursal_id: Optional[int] = None
    departamento_id: Optional[int] = None
    sucursal_nombre: Optional[str] = None
    departamento_nombre: Optional[str] = None

class EgresoRequest(BaseSchema):
    fecha_egreso: date
    motivo_egreso: str
    categoria_egreso_id: int

class ReingresoRequest(BaseSchema):
    fecha_ingreso: date
    sucursal_id: Optional[int] = None
    departamento_id: Optional[int] = None


# ─── CONTRATOS ─────────────────────────────────────────────────────────────────

class ContratoCreate(BaseSchema):
    empleado_id: int
    tipo_contrato: str            # mensual | por_hora
    salario_mensual: Optional[Decimal] = None
    tarifa_hora: Optional[Decimal] = None
    hs_semanales: Optional[int] = 48
    periodo_nomina: str = "mensual"
    fecha_inicio: date
    observacion: Optional[str] = None

class ContratoUpdate(BaseSchema):
    salario_mensual: Optional[Decimal] = None
    tarifa_hora: Optional[Decimal] = None
    hs_semanales: Optional[int] = None
    periodo_nomina: Optional[str] = None
    observacion: Optional[str] = None

class ContratoOut(BaseSchema):
    id: int
    empleado_id: int
    tipo_contrato: str
    salario_mensual: Optional[Decimal] = None
    tarifa_hora: Optional[Decimal] = None
    hs_semanales: Optional[int] = None
    periodo_nomina: str
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    activo: bool
    observacion: Optional[str] = None


# ─── BLOQUES HORARIO ───────────────────────────────────────────────────────────

class BloqueHorarioCreate(BaseSchema):
    orden: int = 1
    hora_inicio: time
    hora_fin: time

class BloqueHorarioUpdate(BaseSchema):
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None

class BloqueHorarioOut(BaseSchema):
    id: int
    turno_id: int
    orden: int
    hora_inicio: time
    hora_fin: time


# ─── FERIADOS ──────────────────────────────────────────────────────────────────

class FeriadoCreate(BaseSchema):
    fecha: date
    nombre: str
    tipo: str = "nacional"   # nacional | provincial | empresa

class FeriadoUpdate(BaseSchema):
    nombre: Optional[str] = None
    tipo: Optional[str] = None

class FeriadoOut(BaseSchema):
    id: int
    fecha: date
    nombre: str
    tipo: str


# ─── TURNOS ────────────────────────────────────────────────────────────────────

class TurnoCreate(BaseSchema):
    nombre: str
    hora_entrada: time
    hora_salida: time
    tolerancia_min: int = 10

class TurnoUpdate(BaseSchema):
    nombre: Optional[str] = None
    hora_entrada: Optional[time] = None
    hora_salida: Optional[time] = None
    tolerancia_min: Optional[int] = None
    activo: Optional[bool] = None

class TurnoOut(BaseSchema):
    id: int
    nombre: str
    hora_entrada: time
    hora_salida: time
    tolerancia_min: int
    activo: bool

class AsignacionTurnoCreate(BaseSchema):
    empleado_id: int
    turno_id: int
    sucursal_id: int
    fecha_desde: date
    fecha_hasta: Optional[date] = None
    # 1=lunes, 2=martes, ..., 6=sábado, None=todos los días
    dia_semana: Optional[int] = None

class AsignacionTurnoOut(BaseSchema):
    id: int
    empleado_id: int
    turno_id: int
    sucursal_id: int
    fecha_desde: date
    fecha_hasta: Optional[date] = None
    dia_semana: Optional[int] = None


# ─── ENCARGADOS ────────────────────────────────────────────────────────────────

class EncargadoCreate(BaseSchema):
    empleado_id: int
    sucursal_id: int
    telefono: Optional[str] = None
    fecha_desde: date
    fecha_hasta: Optional[date] = None

class EncargadoUpdate(BaseSchema):
    telefono: Optional[str] = None
    fecha_hasta: Optional[date] = None
    activo: Optional[bool] = None

class EncargadoOut(BaseSchema):
    id: int
    empleado_id: int
    sucursal_id: int
    telefono: Optional[str] = None
    fecha_desde: date
    fecha_hasta: Optional[date] = None
    activo: bool


# ─── CATEGORIAS EVENTO ─────────────────────────────────────────────────────────

class CategoriaEventoCreate(BaseSchema):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    requiere_aprobacion: bool = True
    afecta_nomina: bool = False
    categoria_padre_id: Optional[int] = None

class CategoriaEventoOut(BaseSchema):
    id: int
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    requiere_aprobacion: bool
    afecta_nomina: bool
    categoria_padre_id: Optional[int] = None
    activo: bool


# ─── EVENTOS ───────────────────────────────────────────────────────────────────

class EventoEmpleadoCreate(BaseSchema):
    empleado_id: int
    sucursal_id: int
    encargado_id: Optional[int] = None
    categoria_evento_id: int
    fecha_inicial: datetime
    fecha_final: Optional[datetime] = None
    observacion: Optional[str] = None
    up_calendar: bool = False
    # Campos para eventos de horas extras
    horas_cantidad: Optional[Decimal] = None
    porcentaje_extra: Optional[int] = None   # 50 o 100; None = se determina automáticamente

class EventoEmpleadoUpdate(BaseSchema):
    encargado_id: Optional[int] = None
    fecha_inicial: Optional[datetime] = None
    fecha_final: Optional[datetime] = None
    observacion: Optional[str] = None
    justificado: Optional[bool] = None
    up_calendar: Optional[bool] = None
    horas_cantidad: Optional[Decimal] = None
    porcentaje_extra: Optional[int] = None

class EventoEmpleadoOut(BaseSchema):
    id: int
    empleado_id: int
    sucursal_id: int
    encargado_id: Optional[int] = None
    categoria_evento_id: int
    fecha_inicial: datetime
    fecha_final: Optional[datetime] = None
    observacion: Optional[str] = None
    estado: str
    justificado: bool
    motivo_actualizacion: Optional[str] = None
    up_calendar: bool
    google_event_id: Optional[str] = None
    horas_cantidad: Optional[Decimal] = None
    porcentaje_extra: Optional[int] = None
    created_at: datetime

class AprobarEventoRequest(BaseSchema):
    justificado: bool = True
    observacion: Optional[str] = None

class RechazarEventoRequest(BaseSchema):
    motivo: str

class EventoHistorialOut(BaseSchema):
    id: int
    evento_id: int
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    cambiado_por: Optional[int] = None
    motivo: Optional[str] = None
    created_at: datetime


# ─── ASISTENCIAS ───────────────────────────────────────────────────────────────

class AsistenciaCreate(BaseSchema):
    empleado_id: int
    turno_id: Optional[int] = None
    bloque_id: Optional[int] = None
    fecha: date
    hora_entrada: time
    hora_salida: Optional[time] = None
    estado: str = "presente"
    observacion: Optional[str] = None

class AsistenciaUpdate(BaseSchema):
    turno_id: Optional[int] = None
    bloque_id: Optional[int] = None
    hora_entrada: Optional[time] = None
    hora_salida: Optional[time] = None
    estado: Optional[str] = None
    observacion: Optional[str] = None

class AsistenciaOut(BaseSchema):
    id: int
    empleado_id: int
    turno_id: Optional[int] = None
    bloque_id: Optional[int] = None
    fecha: date
    hora_entrada: time
    hora_salida: Optional[time] = None
    estado: str
    observacion: Optional[str] = None


# ─── CONCEPTOS NOMINA ──────────────────────────────────────────────────────────

class ConceptoNominaCreate(BaseSchema):
    codigo: str
    nombre: str
    tipo: str          # ingreso | deduccion
    categoria: str
    porcentaje: Optional[Decimal] = None
    monto_fijo: Optional[Decimal] = None

class ConceptoNominaOut(BaseSchema):
    id: int
    codigo: str
    nombre: str
    tipo: str
    categoria: str
    porcentaje: Optional[Decimal] = None
    monto_fijo: Optional[Decimal] = None
    activo: bool


class ConceptoContratoCreate(BaseSchema):
    concepto_id: int

class ConceptoContratoOut(BaseSchema):
    id: int
    contrato_id: int
    concepto_id: int

class ConceptosContratoBulk(BaseSchema):
    concepto_ids: list[int]


# ─── PERIODOS NOMINA ───────────────────────────────────────────────────────────

class PeriodoNominaCreate(BaseSchema):
    tipo: str          # mensual | quincenal
    fecha_inicio: date
    fecha_fin: date

class PeriodoNominaOut(BaseSchema):
    id: int
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    cerrado: bool
    cerrado_por: Optional[int] = None
    cerrado_at: Optional[datetime] = None


# ─── NOMINAS ───────────────────────────────────────────────────────────────────

class NominaDetalleCreate(BaseSchema):
    concepto_id: int
    tipo: str          # ingreso | deduccion
    cantidad: Decimal = Decimal("1")
    monto_unitario: Optional[Decimal] = None
    monto_total: Decimal
    evento_id: Optional[int] = None
    observacion: Optional[str] = None

class NominaDetalleOut(BaseSchema):
    id: int
    nomina_id: int
    concepto_id: int
    tipo: str
    cantidad: Optional[Decimal] = None
    monto_unitario: Optional[Decimal] = None
    monto_total: Decimal
    evento_id: Optional[int] = None
    observacion: Optional[str] = None
    concepto_nombre: Optional[str] = None

class NominaCreate(BaseSchema):
    periodo_id: int
    empleado_id: int
    contrato_id: int
    salario_base: Decimal
    observacion: Optional[str] = None
    detalles: List[NominaDetalleCreate] = []

class NominaUpdate(BaseSchema):
    salario_base: Optional[Decimal] = None
    observacion: Optional[str] = None

class NominaOut(BaseSchema):
    id: int
    empleado_id: int
    contrato_id: int
    periodo_id: int
    salario_base: Decimal
    total_ingresos: Optional[Decimal] = None
    total_deducciones: Optional[Decimal] = None
    neto_a_pagar: Optional[Decimal] = None
    observacion: Optional[str] = None
    empleado_nombre: Optional[str] = None
    created_at: Optional[datetime] = None
