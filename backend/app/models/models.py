from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date,
    ForeignKey, Numeric, Time, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime


class Sucursal(Base):
    __tablename__ = "sucursales"
    id          = Column(Integer, primary_key=True)
    nombre      = Column(String(150), nullable=False)
    ciudad      = Column(String(150))
    direccion   = Column(Text)
    telefono    = Column(String(30))
    activo      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Departamento(Base):
    __tablename__ = "departamentos"
    id          = Column(Integer, primary_key=True)
    nombre      = Column(String(150), nullable=False)
    activo      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CategoriaEgreso(Base):
    __tablename__ = "categorias_egreso"
    id          = Column(Integer, primary_key=True)
    nombre      = Column(String(200), nullable=False)
    tipo        = Column(String(50), nullable=False)
    activo      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


class Empleado(Base):
    __tablename__ = "empleados"
    id                  = Column(Integer, primary_key=True)
    nro_vendedor        = Column(Integer, unique=True, nullable=True)
    nombre              = Column(String(200), nullable=False)
    apellido            = Column(String(200), nullable=False)
    documento           = Column(String(30), unique=True, nullable=True)
    email               = Column(String(200), nullable=True)
    telefono            = Column(String(30), nullable=True)
    fecha_nacimiento    = Column(Date, nullable=True)
    fecha_ingreso       = Column(Date, nullable=False)
    fecha_induccion_fin = Column(Date, nullable=True)
    fecha_egreso        = Column(Date, nullable=True)
    motivo_egreso       = Column(Text, nullable=True)
    categoria_egreso_id = Column(Integer, ForeignKey("categorias_egreso.id"), nullable=True)
    activo              = Column(Boolean, default=True)
    en_blanco           = Column(Boolean, default=False)
    sucursal_id         = Column(Integer, ForeignKey("sucursales.id"), nullable=True)
    departamento_id     = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contrato(Base):
    __tablename__ = "contratos"
    id              = Column(Integer, primary_key=True)
    empleado_id     = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    tipo_contrato   = Column(String(20), nullable=False)   # mensual | por_hora
    salario_mensual = Column(Numeric(12, 2), nullable=True)
    tarifa_hora     = Column(Numeric(10, 2), nullable=True)
    hs_semanales    = Column(Integer, nullable=True, default=48)
    periodo_nomina  = Column(String(20), default="mensual") # mensual | quincenal
    fecha_inicio    = Column(Date, nullable=False)
    fecha_fin       = Column(Date, nullable=True)
    activo          = Column(Boolean, default=True)
    observacion     = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Turno(Base):
    __tablename__ = "turnos"
    id              = Column(Integer, primary_key=True)
    nombre          = Column(String(100), nullable=False)
    hora_entrada    = Column(Time, nullable=False)
    hora_salida     = Column(Time, nullable=False)
    tolerancia_min  = Column(Integer, default=10)
    activo          = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BloqueHorario(Base):
    __tablename__ = "bloques_horario"
    id          = Column(Integer, primary_key=True)
    turno_id    = Column(Integer, ForeignKey("turnos.id"), nullable=False)
    orden       = Column(Integer, nullable=False, default=1)  # 1=primero, 2=segundo
    hora_inicio = Column(Time, nullable=False)
    hora_fin    = Column(Time, nullable=False)


class Feriado(Base):
    __tablename__ = "feriados"
    id      = Column(Integer, primary_key=True)
    fecha   = Column(Date, nullable=False, unique=True)
    nombre  = Column(String(200), nullable=False)
    tipo    = Column(String(50), nullable=False, default="nacional")  # nacional|provincial|empresa


class AsignacionTurno(Base):
    __tablename__ = "asignaciones_turno"
    id              = Column(Integer, primary_key=True)
    empleado_id     = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    turno_id        = Column(Integer, ForeignKey("turnos.id"), nullable=False)
    sucursal_id     = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    fecha_desde     = Column(Date, nullable=False)
    fecha_hasta     = Column(Date, nullable=True)
    # 1=lunes ... 6=sábado, NULL=todos los días del rango
    dia_semana      = Column(Integer, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Encargado(Base):
    __tablename__ = "encargados"
    id              = Column(Integer, primary_key=True)
    empleado_id     = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    sucursal_id     = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    telefono        = Column(String(30), nullable=True)
    fecha_desde     = Column(Date, nullable=False)
    fecha_hasta     = Column(Date, nullable=True)
    activo          = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class CategoriaEvento(Base):
    __tablename__ = "categorias_evento"
    id                  = Column(Integer, primary_key=True)
    codigo              = Column(String(50), unique=True, nullable=False)
    nombre              = Column(String(150), nullable=False)
    descripcion         = Column(Text, nullable=True)
    requiere_aprobacion = Column(Boolean, default=True)
    afecta_nomina       = Column(Boolean, default=False)
    categoria_padre_id  = Column(Integer, ForeignKey("categorias_evento.id"), nullable=True)
    activo              = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)


class EventoEmpleado(Base):
    __tablename__ = "eventos_empleados"
    id                  = Column(Integer, primary_key=True)
    empleado_id         = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    sucursal_id         = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    encargado_id        = Column(Integer, ForeignKey("encargados.id"), nullable=True)
    categoria_evento_id = Column(Integer, ForeignKey("categorias_evento.id"), nullable=False)
    fecha_inicial       = Column(DateTime, nullable=False)
    fecha_final         = Column(DateTime, nullable=True)
    observacion         = Column(Text, nullable=True)
    estado              = Column(String(20), default="sin_revisar")
    justificado         = Column(Boolean, default=False)
    motivo_actualizacion = Column(Text, nullable=True)
    up_calendar         = Column(Boolean, default=False)
    google_event_id     = Column(String(255), nullable=True)
    # Campos para horas extras
    horas_cantidad      = Column(Numeric(6, 2), nullable=True)
    porcentaje_extra    = Column(Integer, nullable=True)  # 50 o 100
    created_by_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EventoHistorial(Base):
    __tablename__ = "eventos_historial"
    id              = Column(Integer, primary_key=True)
    evento_id       = Column(Integer, ForeignKey("eventos_empleados.id"), nullable=False)
    estado_anterior = Column(String(20), nullable=True)
    estado_nuevo    = Column(String(20), nullable=False)
    cambiado_por    = Column(Integer, ForeignKey("empleados.id"), nullable=True)
    motivo          = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class ConceptoNomina(Base):
    __tablename__ = "conceptos_nomina"
    id          = Column(Integer, primary_key=True)
    codigo      = Column(String(50), unique=True, nullable=False)
    nombre      = Column(String(150), nullable=False)
    tipo        = Column(String(20), nullable=False)   # ingreso | deduccion
    categoria   = Column(String(50), nullable=False)
    porcentaje  = Column(Numeric(6, 4), nullable=True)
    monto_fijo  = Column(Numeric(12, 2), nullable=True)
    activo      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


class ConceptoContrato(Base):
    __tablename__ = "conceptos_contrato"
    __table_args__ = (UniqueConstraint('contrato_id', 'concepto_id', name='uq_contrato_concepto'),)
    id          = Column(Integer, primary_key=True)
    contrato_id = Column(Integer, ForeignKey("contratos.id", ondelete="CASCADE"), nullable=False)
    concepto_id = Column(Integer, ForeignKey("conceptos_nomina.id", ondelete="CASCADE"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)


class PeriodoNomina(Base):
    __tablename__ = "periodos_nomina"
    id          = Column(Integer, primary_key=True)
    tipo        = Column(String(20), nullable=False)   # mensual | quincenal
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin   = Column(Date, nullable=False)
    cerrado     = Column(Boolean, default=False)
    cerrado_por = Column(Integer, ForeignKey("empleados.id"), nullable=True)
    cerrado_at  = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


class Nomina(Base):
    __tablename__ = "nominas"
    id                = Column(Integer, primary_key=True)
    empleado_id       = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    contrato_id       = Column(Integer, ForeignKey("contratos.id"), nullable=False)
    periodo_id        = Column(Integer, ForeignKey("periodos_nomina.id"), nullable=False)
    salario_base      = Column(Numeric(12, 2), nullable=False)
    total_ingresos    = Column(Numeric(12, 2), default=0)
    total_deducciones = Column(Numeric(12, 2), default=0)
    neto_a_pagar      = Column(Numeric(12, 2), default=0)
    observacion       = Column(Text, nullable=True)
    # Control de pago
    pagado            = Column(Boolean, default=False)
    fecha_pago        = Column(DateTime, nullable=True)
    pagado_por_id     = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    monto_pagado      = Column(Numeric(12, 2), nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NominaDetalle(Base):
    __tablename__ = "nomina_detalle"
    id              = Column(Integer, primary_key=True)
    nomina_id       = Column(Integer, ForeignKey("nominas.id"), nullable=False)
    concepto_id     = Column(Integer, ForeignKey("conceptos_nomina.id"), nullable=False)
    tipo            = Column(String(20), nullable=False)   # ingreso | deduccion
    cantidad        = Column(Numeric(10, 2), default=1)
    monto_unitario  = Column(Numeric(12, 2), nullable=True)
    monto_total     = Column(Numeric(12, 2), nullable=False)
    evento_id       = Column(Integer, ForeignKey("eventos_empleados.id"), nullable=True)
    observacion     = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class HorasExtras(Base):
    __tablename__ = "horas_extras"
    id              = Column(Integer, primary_key=True)
    empleado_id     = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    fecha           = Column(Date, nullable=False)
    horas_cantidad  = Column(Numeric(6, 2), nullable=False)
    porcentaje      = Column(Integer, nullable=False)  # 50 o 100
    observacion     = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class CuentaCorriente(Base):
    """Movimientos de cuenta corriente del empleado (compras a descontar en nómina)."""
    __tablename__ = "cuenta_corriente"
    id              = Column(Integer, primary_key=True)
    empleado_id     = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    fecha           = Column(Date, nullable=False)
    monto           = Column(Numeric(12, 2), nullable=False)   # siempre positivo
    descripcion     = Column(Text, nullable=True)
    # nomina_id se setea cuando el cargo fue descontado en una nómina
    nomina_id       = Column(Integer, ForeignKey("nominas.id"), nullable=True)
    created_by_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Asistencia(Base):
    __tablename__ = "asistencias"
    id              = Column(Integer, primary_key=True)
    empleado_id     = Column(Integer, ForeignKey("empleados.id"), nullable=False)
    turno_id        = Column(Integer, ForeignKey("turnos.id"), nullable=True)
    bloque_id       = Column(Integer, ForeignKey("bloques_horario.id"), nullable=True)
    fecha           = Column(Date, nullable=False)
    hora_entrada    = Column(Time, nullable=False)
    hora_salida     = Column(Time, nullable=True)
    estado          = Column(String(50), default="presente")
    observacion     = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
