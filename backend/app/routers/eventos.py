from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import EventoEmpleado, EventoHistorial, Empleado, CategoriaEvento
from app.models.usuario import Usuario
from app.schemas.schemas import (
    EventoEmpleadoCreate, EventoEmpleadoOut, EventoEmpleadoUpdate,
    AprobarEventoRequest, RechazarEventoRequest, EventoHistorialOut,
)

router = APIRouter(prefix="/eventos", tags=["Eventos"])


@router.get("/pendientes", response_model=list[EventoEmpleadoOut])
async def pendientes(
    sucursal_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(EventoEmpleado).where(EventoEmpleado.estado == "sin_revisar")
    if sucursal_id:
        q = q.where(EventoEmpleado.sucursal_id == sucursal_id)
    q = q.order_by(EventoEmpleado.fecha_inicial.desc()).offset(skip).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


@router.get("", response_model=list[EventoEmpleadoOut])
async def listar(
    empleado_id: int | None = None,
    estado: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(EventoEmpleado)
    if empleado_id:
        q = q.where(EventoEmpleado.empleado_id == empleado_id)
    if estado:
        q = q.where(EventoEmpleado.estado == estado)
    q = q.offset(skip).limit(limit).order_by(EventoEmpleado.fecha_inicial.desc())
    r = await db.execute(q)
    return r.scalars().all()


@router.get("/{id}", response_model=EventoEmpleadoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    e = await db.get(EventoEmpleado, id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    return e


@router.get("/{id}/historial", response_model=list[EventoHistorialOut])
async def historial(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    e = await db.get(EventoEmpleado, id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    r = await db.execute(
        select(EventoHistorial).where(EventoHistorial.evento_id == id)
        .order_by(EventoHistorial.created_at)
    )
    return r.scalars().all()


@router.post("", response_model=EventoEmpleadoOut, status_code=201)
async def crear(
    body: EventoEmpleadoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin", "rrhh")),
):
    cat = await db.get(CategoriaEvento, body.categoria_evento_id)
    if not cat:
        raise HTTPException(404, "Categoría de evento no encontrada")

    if cat.codigo == "solicitud_vacaciones":
        emp = await db.get(Empleado, body.empleado_id)
        if not emp:
            raise HTTPException(404, "Empleado no encontrado")
        hoy = date.today()
        anios = hoy.year - emp.fecha_ingreso.year - ((hoy.month, hoy.day) < (emp.fecha_ingreso.month, emp.fecha_ingreso.day))
        dias_max = 14
        if anios >= 5: dias_max = 21
        if anios >= 10: dias_max = 28
        if anios >= 20: dias_max = 35
        if body.fecha_final and body.fecha_inicial:
            dias = (body.fecha_final.date() - body.fecha_inicial.date()).days
            if dias > dias_max:
                raise HTTPException(400, f"Solicita {dias} días, corresponden {dias_max} según antigüedad")

    e = EventoEmpleado(**body.model_dump())
    db.add(e)
    await db.flush()

    historial = EventoHistorial(
        evento_id=e.id,
        estado_anterior=None,
        estado_nuevo="sin_revisar",
        motivo="Creación del evento",
    )
    db.add(historial)
    await db.commit()
    await db.refresh(e)
    return e


@router.patch("/{id}", response_model=EventoEmpleadoOut)
async def actualizar(
    id: int,
    body: EventoEmpleadoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    e = await db.get(EventoEmpleado, id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    await db.commit()
    await db.refresh(e)
    return e


@router.post("/{id}/aprobar", response_model=EventoEmpleadoOut)
async def aprobar(
    id: int,
    body: AprobarEventoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    e = await db.get(EventoEmpleado, id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    if e.estado == "aprobado":
        raise HTTPException(400, "El evento ya está aprobado")

    estado_anterior = e.estado
    e.estado = "aprobado"
    e.justificado = body.justificado
    if body.observacion:
        e.motivo_actualizacion = body.observacion

    historial = EventoHistorial(
        evento_id=e.id,
        estado_anterior=estado_anterior,
        estado_nuevo="aprobado",
        cambiado_por=current_user.empleado_id,
        motivo=body.observacion,
    )
    db.add(historial)
    await db.commit()
    await db.refresh(e)
    return e


@router.post("/{id}/rechazar", response_model=EventoEmpleadoOut)
async def rechazar(
    id: int,
    body: RechazarEventoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    e = await db.get(EventoEmpleado, id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    if e.estado == "rechazado":
        raise HTTPException(400, "El evento ya está rechazado")

    estado_anterior = e.estado
    e.estado = "rechazado"
    e.motivo_actualizacion = body.motivo

    historial = EventoHistorial(
        evento_id=e.id,
        estado_anterior=estado_anterior,
        estado_nuevo="rechazado",
        cambiado_por=current_user.empleado_id,
        motivo=body.motivo,
    )
    db.add(historial)
    await db.commit()
    await db.refresh(e)
    return e


@router.delete("/{id}", status_code=204)
async def eliminar(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin")),
):
    e = await db.get(EventoEmpleado, id)
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    await db.delete(e)
    await db.commit()
