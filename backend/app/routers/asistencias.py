from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import Asistencia, Turno
from app.models.usuario import Usuario
from app.schemas.schemas import AsistenciaCreate, AsistenciaUpdate, AsistenciaOut

router = APIRouter(prefix="/asistencias", tags=["Asistencias"])


@router.get("", response_model=list[AsistenciaOut])
async def listar(
    empleado_id: int | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Asistencia)
    if empleado_id:
        q = q.where(Asistencia.empleado_id == empleado_id)
    if fecha_desde:
        q = q.where(Asistencia.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.where(Asistencia.fecha <= fecha_hasta)
    q = q.order_by(Asistencia.fecha.desc(), Asistencia.hora_entrada.desc()).offset(skip).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("", response_model=AsistenciaOut, status_code=201)
async def crear_manual(
    body: AsistenciaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    """Carga manual de asistencia por un administrador."""
    existe = await db.execute(
        select(Asistencia).where(
            Asistencia.empleado_id == body.empleado_id,
            Asistencia.fecha == body.fecha,
        )
    )
    if existe.scalars().first():
        raise HTTPException(400, "Ya existe un registro de asistencia para ese empleado en esa fecha")
    a = Asistencia(**body.model_dump())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@router.post("/check-in", response_model=AsistenciaOut, status_code=201)
async def check_in(
    empleado_id: int,
    turno_id: int | None = None,
    observacion: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    hoy = date.today()
    existe = await db.execute(
        select(Asistencia).where(Asistencia.empleado_id == empleado_id, Asistencia.fecha == hoy)
    )
    if existe.scalars().first():
        raise HTTPException(400, "El empleado ya registró entrada hoy")

    estado = "presente"
    if turno_id:
        turno = await db.get(Turno, turno_id)
        if turno:
            ahora = datetime.now().time()
            from datetime import timedelta
            hora_limite = (
                datetime.combine(hoy, turno.hora_entrada) + timedelta(minutes=turno.tolerancia_min)
            ).time()
            if ahora > hora_limite:
                estado = "tarde"

    nueva = Asistencia(
        empleado_id=empleado_id,
        turno_id=turno_id,
        fecha=hoy,
        hora_entrada=datetime.now().time(),
        estado=estado,
        observacion=observacion,
    )
    db.add(nueva)
    await db.commit()
    await db.refresh(nueva)
    return nueva


@router.post("/check-out", response_model=AsistenciaOut)
async def check_out(
    empleado_id: int,
    observacion: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    hoy = date.today()
    r = await db.execute(
        select(Asistencia).where(Asistencia.empleado_id == empleado_id, Asistencia.fecha == hoy)
    )
    asistencia = r.scalars().first()
    if not asistencia:
        raise HTTPException(404, "No se encontró registro de entrada para hoy")
    if asistencia.hora_salida:
        raise HTTPException(400, "El empleado ya registró salida hoy")

    asistencia.hora_salida = datetime.now().time()
    if observacion:
        asistencia.observacion = (asistencia.observacion or "") + " | " + observacion
    await db.commit()
    await db.refresh(asistencia)
    return asistencia


@router.put("/{id}", response_model=AsistenciaOut)
async def actualizar(
    id: int,
    body: AsistenciaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "rrhh")),
):
    a = await db.get(Asistencia, id)
    if not a:
        raise HTTPException(404, "Registro de asistencia no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await db.commit()
    await db.refresh(a)
    return a


@router.delete("/{id}", status_code=204)
async def eliminar(
    id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin")),
):
    a = await db.get(Asistencia, id)
    if not a:
        raise HTTPException(404, "Registro de asistencia no encontrado")
    await db.delete(a)
    await db.commit()
