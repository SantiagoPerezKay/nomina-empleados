from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import Empleado, Contrato, EventoEmpleado, Asistencia, Nomina, CategoriaEgreso, Sucursal, Departamento
from app.models.usuario import Usuario
from app.schemas.schemas import (
    EmpleadoCreate, EmpleadoOut, EmpleadoUpdate,
    EgresoRequest, ReingresoRequest,
    ContratoOut, EventoEmpleadoOut, AsistenciaOut, NominaOut,
)


async def _enrich_empleado(emp: Empleado, db: AsyncSession) -> dict:
    """Add sucursal_nombre and departamento_nombre to empleado."""
    data = {c.name: getattr(emp, c.name) for c in emp.__table__.columns}
    if emp.sucursal_id:
        suc = await db.get(Sucursal, emp.sucursal_id)
        data["sucursal_nombre"] = suc.nombre if suc else None
    if emp.departamento_id:
        dep = await db.get(Departamento, emp.departamento_id)
        data["departamento_nombre"] = dep.nombre if dep else None
    return data

router = APIRouter(prefix="/empleados", tags=["Empleados"])


@router.get("", response_model=list[EmpleadoOut])
async def listar(
    activo: bool | None = None,
    sucursal_id: int | None = None,
    departamento_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    q = select(Empleado)
    if activo is not None:
        q = q.where(Empleado.activo == activo)
    if sucursal_id:
        q = q.where(Empleado.sucursal_id == sucursal_id)
    if departamento_id:
        q = q.where(Empleado.departamento_id == departamento_id)
    q = q.offset(skip).limit(limit).order_by(Empleado.apellido)
    result = await db.execute(q)
    empleados = result.scalars().all()
    return [await _enrich_empleado(e, db) for e in empleados]


@router.get("/{id}", response_model=EmpleadoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    return await _enrich_empleado(emp, db)


@router.post("", response_model=EmpleadoOut, status_code=201)
async def crear(
    body: EmpleadoCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    emp = Empleado(**body.model_dump())
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return await _enrich_empleado(emp, db)


@router.put("/{id}", response_model=EmpleadoOut)
async def actualizar(
    id: int,
    body: EmpleadoUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(emp, k, v)
    await db.commit()
    await db.refresh(emp)
    return await _enrich_empleado(emp, db)


@router.post("/{id}/egresar", response_model=EmpleadoOut)
async def egresar(
    id: int,
    body: EgresoRequest,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    if not emp.activo:
        raise HTTPException(400, "El empleado ya está egresado")
    cat = await db.get(CategoriaEgreso, body.categoria_egreso_id)
    if not cat:
        raise HTTPException(400, "Categoría de egreso inválida")

    emp.activo = False
    emp.fecha_egreso = body.fecha_egreso
    emp.motivo_egreso = body.motivo_egreso
    emp.categoria_egreso_id = body.categoria_egreso_id

    # Cerrar contrato activo
    r = await db.execute(select(Contrato).where(Contrato.empleado_id == id, Contrato.activo == True))
    contrato = r.scalars().first()
    if contrato:
        contrato.activo = False
        contrato.fecha_fin = body.fecha_egreso

    await db.commit()
    await db.refresh(emp)
    return emp


@router.post("/{id}/reingreso", response_model=EmpleadoOut)
async def reingreso(
    id: int,
    body: ReingresoRequest,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    if emp.activo:
        raise HTTPException(400, "El empleado ya está activo")

    emp.activo = True
    emp.fecha_egreso = None
    emp.motivo_egreso = None
    emp.categoria_egreso_id = None
    emp.fecha_ingreso = body.fecha_ingreso
    if body.sucursal_id:
        emp.sucursal_id = body.sucursal_id
    if body.departamento_id:
        emp.departamento_id = body.departamento_id

    await db.commit()
    await db.refresh(emp)
    return emp


@router.get("/{id}/contratos", response_model=list[ContratoOut])
async def contratos_del_empleado(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    r = await db.execute(select(Contrato).where(Contrato.empleado_id == id).order_by(Contrato.fecha_inicio.desc()))
    return r.scalars().all()


@router.get("/{id}/eventos", response_model=list[EventoEmpleadoOut])
async def eventos_del_empleado(
    id: int,
    estado: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    q = select(EventoEmpleado).where(EventoEmpleado.empleado_id == id)
    if estado:
        q = q.where(EventoEmpleado.estado == estado)
    q = q.order_by(EventoEmpleado.fecha_inicial.desc()).offset(skip).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


@router.get("/{id}/asistencias", response_model=list[AsistenciaOut])
async def asistencias_del_empleado(
    id: int,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    q = select(Asistencia).where(Asistencia.empleado_id == id)
    if fecha_desde:
        q = q.where(Asistencia.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.where(Asistencia.fecha <= fecha_hasta)
    q = q.order_by(Asistencia.fecha.desc()).offset(skip).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


@router.get("/{id}/nominas", response_model=list[NominaOut])
async def nominas_del_empleado(
    id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(24, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    emp = await db.get(Empleado, id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    r = await db.execute(
        select(Nomina).where(Nomina.empleado_id == id)
        .order_by(Nomina.created_at.desc()).offset(skip).limit(limit)
    )
    return r.scalars().all()
