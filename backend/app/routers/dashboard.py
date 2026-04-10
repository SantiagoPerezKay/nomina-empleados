from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Empleado, Nomina, EventoEmpleado, Asistencia, Sucursal, CategoriaEvento

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardKPIs(BaseModel):
    total_empleados_activos: int
    total_nomina_mes_actual: float
    eventos_pendientes: int
    asistencias_hoy: int
    ausentes_hoy: int

class EventoPendienteResumen(BaseModel):
    id: int
    empleado_id: int
    categoria_evento_id: int
    fecha_inicial: str
    estado: str

class NominaPorSucursal(BaseModel):
    sucursal_id: Optional[int]
    sucursal_nombre: Optional[str]
    total_empleados: int
    total_neto: float


@router.get("/kpis", response_model=DashboardKPIs)
async def obtener_kpis(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    hoy = date.today()

    total_emp = (await db.execute(
        select(func.count(Empleado.id)).where(Empleado.activo == True)
    )).scalar() or 0

    total_nom = (await db.execute(
        select(func.sum(Nomina.neto_a_pagar)).where(
            func.extract("month", Nomina.created_at) == hoy.month,
            func.extract("year", Nomina.created_at) == hoy.year,
        )
    )).scalar() or 0.0

    eventos_pend = (await db.execute(
        select(func.count(EventoEmpleado.id)).where(EventoEmpleado.estado == "sin_revisar")
    )).scalar() or 0

    # Ausentes = empleados con evento de falta injustificada aprobado hoy
    r_cat_falta = await db.execute(
        select(CategoriaEvento.id).where(
            CategoriaEvento.codigo.in_(["FALTA_INJ", "falta_inj", "ausencia", "falta"])
        )
    )
    cat_falta_ids = set(r_cat_falta.scalars().all())

    if cat_falta_ids:
        ausentes = (await db.execute(
            select(func.count(func.distinct(EventoEmpleado.empleado_id))).where(
                func.date(EventoEmpleado.fecha_inicial) == hoy,
                EventoEmpleado.categoria_evento_id.in_(cat_falta_ids),
                EventoEmpleado.estado == "aprobado",
            )
        )).scalar() or 0
    else:
        ausentes = 0

    # Presentes = empleados activos - ausentes
    presentes_hoy = max(0, total_emp - ausentes)

    return DashboardKPIs(
        total_empleados_activos=total_emp,
        total_nomina_mes_actual=float(total_nom),
        eventos_pendientes=eventos_pend,
        asistencias_hoy=presentes_hoy,
        ausentes_hoy=ausentes,
    )


@router.get("/eventos-pendientes", response_model=list[EventoPendienteResumen])
async def eventos_pendientes(
    sucursal_id: int | None = None,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(EventoEmpleado).where(EventoEmpleado.estado == "sin_revisar")
    if sucursal_id:
        q = q.where(EventoEmpleado.sucursal_id == sucursal_id)
    q = q.order_by(EventoEmpleado.fecha_inicial).limit(limit)
    r = await db.execute(q)
    eventos = r.scalars().all()
    return [
        EventoPendienteResumen(
            id=e.id,
            empleado_id=e.empleado_id,
            categoria_evento_id=e.categoria_evento_id,
            fecha_inicial=str(e.fecha_inicial),
            estado=e.estado,
        )
        for e in eventos
    ]


@router.get("/nominas-por-sucursal", response_model=list[NominaPorSucursal])
async def nominas_por_sucursal(
    periodo_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Totales de nómina agrupados por sucursal."""
    # Si no se pasa periodo_id usa el mes actual
    hoy = date.today()
    q = (
        select(
            Empleado.sucursal_id,
            Sucursal.nombre,
            func.count(Nomina.id),
            func.sum(Nomina.neto_a_pagar),
        )
        .join(Empleado, Nomina.empleado_id == Empleado.id)
        .outerjoin(Sucursal, Empleado.sucursal_id == Sucursal.id)
    )
    if periodo_id:
        q = q.where(Nomina.periodo_id == periodo_id)
    else:
        q = q.where(
            func.extract("month", Nomina.created_at) == hoy.month,
            func.extract("year", Nomina.created_at) == hoy.year,
        )
    q = q.group_by(Empleado.sucursal_id, Sucursal.nombre).order_by(Sucursal.nombre)
    r = await db.execute(q)
    rows = r.all()

    return [
        NominaPorSucursal(
            sucursal_id=row[0],
            sucursal_nombre=row[1],
            total_empleados=row[2],
            total_neto=float(row[3] or 0),
        )
        for row in rows
    ]
