from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import (
    Empleado, Nomina, NominaDetalle, PeriodoNomina,
    Contrato, Asistencia, Sucursal, EventoEmpleado, CategoriaEvento,
)
from app.models.usuario import Usuario

router = APIRouter(prefix="/reportes", tags=["Reportes"])


# ─── Schemas de respuesta ─────────────────────────────────────────────────────

class ReporteNominaEmpleado(BaseModel):
    empleado_id: int
    nombre: str
    apellido: str
    salario_base: Decimal
    total_ingresos: Decimal
    total_deducciones: Decimal
    neto_a_pagar: Decimal

class ReporteAsistenciaEmpleado(BaseModel):
    empleado_id: int
    nombre: str
    apellido: str
    dias_presentes: int
    dias_tarde: int
    dias_ausente: int

class ReporteEgreso(BaseModel):
    empleado_id: int
    nombre: str
    apellido: str
    fecha_ingreso: date
    fecha_egreso: date
    motivo_egreso: Optional[str]
    sucursal: Optional[str]

class ReporteEmpleadoActivo(BaseModel):
    empleado_id: int
    nombre: str
    apellido: str
    sucursal: Optional[str]
    departamento_id: Optional[int]
    fecha_ingreso: date
    tipo_contrato: Optional[str]
    salario_mensual: Optional[Decimal]
    tarifa_hora: Optional[Decimal]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/nomina/{periodo_id}", response_model=list[ReporteNominaEmpleado])
async def reporte_nomina_periodo(
    periodo_id: int,
    sucursal_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    """Nómina completa del período con detalle por empleado."""
    periodo = await db.get(PeriodoNomina, periodo_id)
    if not periodo:
        raise HTTPException(404, "Período no encontrado")

    q = select(Nomina, Empleado).join(Empleado, Nomina.empleado_id == Empleado.id)
    q = q.where(Nomina.periodo_id == periodo_id)
    if sucursal_id:
        q = q.where(Empleado.sucursal_id == sucursal_id)
    q = q.order_by(Empleado.apellido)

    r = await db.execute(q)
    rows = r.all()

    return [
        ReporteNominaEmpleado(
            empleado_id=emp.id,
            nombre=emp.nombre,
            apellido=emp.apellido,
            salario_base=nom.salario_base or Decimal(0),
            total_ingresos=nom.total_ingresos or Decimal(0),
            total_deducciones=nom.total_deducciones or Decimal(0),
            neto_a_pagar=nom.neto_a_pagar or Decimal(0),
        )
        for nom, emp in rows
    ]


@router.get("/asistencias", response_model=list[ReporteAsistenciaEmpleado])
async def reporte_asistencias(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    sucursal_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh", "liquidador")),
):
    """Resumen de asistencias por empleado en un rango de fechas."""
    q = select(Empleado).where(Empleado.activo == True)
    if sucursal_id:
        q = q.where(Empleado.sucursal_id == sucursal_id)
    r = await db.execute(q.order_by(Empleado.apellido))
    empleados = r.scalars().all()

    # Buscar categoría de falta injustificada
    r_cat = await db.execute(
        select(CategoriaEvento).where(CategoriaEvento.codigo.in_(["FALTA_INJ", "falta_inj"]))
    )
    cat_falta = r_cat.scalars().first()

    # Días hábiles en el rango (lunes a sábado)
    total_dias = (fecha_hasta - fecha_desde).days + 1
    dias_habiles = sum(
        1 for i in range(total_dias)
        if (fecha_desde.toordinal() + i) % 7 != 6  # excluir solo domingo
    )

    resultado = []
    for emp in empleados:
        # Ausentes = eventos FALTA_INJ aprobados en el rango
        ausentes = 0
        if cat_falta:
            r_faltas = await db.execute(
                select(EventoEmpleado).where(
                    EventoEmpleado.empleado_id == emp.id,
                    EventoEmpleado.categoria_evento_id == cat_falta.id,
                    EventoEmpleado.estado == "aprobado",
                    EventoEmpleado.fecha_inicial >= fecha_desde,
                    EventoEmpleado.fecha_inicial <= fecha_hasta,
                )
            )
            ausentes = len(r_faltas.scalars().all())

        # Tardanzas desde registros de asistencia
        r_asist = await db.execute(
            select(Asistencia).where(
                Asistencia.empleado_id == emp.id,
                Asistencia.fecha >= fecha_desde,
                Asistencia.fecha <= fecha_hasta,
                Asistencia.estado == "tarde",
            )
        )
        tarde = len(r_asist.scalars().all())

        # Presentes = días hábiles - ausentes - tardes
        presentes = max(0, dias_habiles - ausentes - tarde)

        resultado.append(ReporteAsistenciaEmpleado(
            empleado_id=emp.id,
            nombre=emp.nombre,
            apellido=emp.apellido,
            dias_presentes=presentes,
            dias_tarde=tarde,
            dias_ausente=ausentes,
        ))
    return resultado


@router.get("/egresos", response_model=list[ReporteEgreso])
async def reporte_egresos(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    sucursal_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    """Empleados egresados en un rango de fechas."""
    q = (
        select(Empleado, Sucursal)
        .outerjoin(Sucursal, Empleado.sucursal_id == Sucursal.id)
        .where(
            Empleado.activo == False,
            Empleado.fecha_egreso >= fecha_desde,
            Empleado.fecha_egreso <= fecha_hasta,
        )
    )
    if sucursal_id:
        q = q.where(Empleado.sucursal_id == sucursal_id)
    q = q.order_by(Empleado.fecha_egreso.desc())
    r = await db.execute(q)
    rows = r.all()

    return [
        ReporteEgreso(
            empleado_id=emp.id,
            nombre=emp.nombre,
            apellido=emp.apellido,
            fecha_ingreso=emp.fecha_ingreso,
            fecha_egreso=emp.fecha_egreso,
            motivo_egreso=emp.motivo_egreso,
            sucursal=suc.nombre if suc else None,
        )
        for emp, suc in rows
    ]


@router.get("/empleados/activos", response_model=list[ReporteEmpleadoActivo])
async def reporte_empleados_activos(
    sucursal_id: int | None = None,
    departamento_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh", "liquidador")),
):
    """Plantel activo con su contrato vigente."""
    q = (
        select(Empleado, Contrato, Sucursal)
        .outerjoin(Contrato, and_(Contrato.empleado_id == Empleado.id, Contrato.activo == True))
        .outerjoin(Sucursal, Empleado.sucursal_id == Sucursal.id)
        .where(Empleado.activo == True)
    )
    if sucursal_id:
        q = q.where(Empleado.sucursal_id == sucursal_id)
    if departamento_id:
        q = q.where(Empleado.departamento_id == departamento_id)
    q = q.order_by(Empleado.apellido)
    r = await db.execute(q)
    rows = r.all()

    return [
        ReporteEmpleadoActivo(
            empleado_id=emp.id,
            nombre=emp.nombre,
            apellido=emp.apellido,
            sucursal=suc.nombre if suc else None,
            departamento_id=emp.departamento_id,
            fecha_ingreso=emp.fecha_ingreso,
            tipo_contrato=cont.tipo_contrato if cont else None,
            salario_mensual=cont.salario_mensual if cont else None,
            tarifa_hora=cont.tarifa_hora if cont else None,
        )
        for emp, cont, suc in rows
    ]
