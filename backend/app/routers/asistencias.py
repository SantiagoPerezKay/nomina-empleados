from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import Asistencia, Turno, BloqueHorario, AsignacionTurno
from app.models.usuario import Usuario
from app.schemas.schemas import AsistenciaCreate, AsistenciaUpdate, AsistenciaOut

router = APIRouter(prefix="/asistencias", tags=["Asistencias"])


async def _turno_activo_hoy(empleado_id: int, hoy: date, db: AsyncSession) -> Turno | None:
    """Devuelve el turno asignado al empleado para el día de hoy (considera dia_semana)."""
    dia_iso = hoy.isoweekday()  # 1=lunes .. 7=domingo
    r = await db.execute(
        select(AsignacionTurno).where(
            AsignacionTurno.empleado_id == empleado_id,
            AsignacionTurno.fecha_desde <= hoy,
            (AsignacionTurno.fecha_hasta == None) | (AsignacionTurno.fecha_hasta >= hoy),
        )
    )
    asignaciones = r.scalars().all()
    # Preferir la asignación específica para este día de semana
    for a in asignaciones:
        if a.dia_semana == dia_iso:
            return await db.get(Turno, a.turno_id)
    # Si no hay específica, buscar una general (dia_semana is null)
    for a in asignaciones:
        if a.dia_semana is None:
            return await db.get(Turno, a.turno_id)
    return None


async def _bloque_para_hora(turno_id: int, hora_actual, db: AsyncSession) -> BloqueHorario | None:
    """Encuentra el bloque horario del turno que corresponde a la hora actual (ventana ±30 min)."""
    r = await db.execute(
        select(BloqueHorario)
        .where(BloqueHorario.turno_id == turno_id)
        .order_by(BloqueHorario.orden)
    )
    bloques = r.scalars().all()
    if not bloques:
        return None

    hoy = date.today()
    ventana = timedelta(minutes=30)
    for bloque in bloques:
        inicio = (datetime.combine(hoy, bloque.hora_inicio) - ventana).time()
        fin = (datetime.combine(hoy, bloque.hora_fin) + ventana).time()
        if inicio <= hora_actual <= fin:
            return bloque
    return None


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
    """Carga manual de asistencia por un administrador. Permite múltiples registros por día (uno por bloque)."""
    # Si se especifica bloque_id, verificar que no exista ya para ese bloque en ese día
    if body.bloque_id:
        existe = await db.execute(
            select(Asistencia).where(
                Asistencia.empleado_id == body.empleado_id,
                Asistencia.fecha == body.fecha,
                Asistencia.bloque_id == body.bloque_id,
            )
        )
        if existe.scalars().first():
            raise HTTPException(400, "Ya existe asistencia para ese bloque en esa fecha")
    else:
        # Turno corrido: solo 1 registro sin bloque por día
        existe = await db.execute(
            select(Asistencia).where(
                Asistencia.empleado_id == body.empleado_id,
                Asistencia.fecha == body.fecha,
                Asistencia.bloque_id == None,
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
    bloque_id: int | None = None,
    observacion: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """
    Registra entrada del empleado.
    - Si el turno tiene bloques horarios definidos, detecta automáticamente el bloque por hora actual.
    - Permite múltiples check-ins por día (uno por bloque en horario cortado).
    - Detecta tardanza comparando contra hora_inicio del bloque + tolerancia del turno.
    """
    hoy = date.today()
    ahora = datetime.now().time()

    # Resolver turno si no se pasó
    turno = None
    if turno_id:
        turno = await db.get(Turno, turno_id)
    else:
        turno = await _turno_activo_hoy(empleado_id, hoy, db)
        if turno:
            turno_id = turno.id

    # Resolver bloque
    bloque = None
    if bloque_id:
        bloque = await db.get(BloqueHorario, bloque_id)
    elif turno:
        bloque = await _bloque_para_hora(turno.id, ahora, db)
        if bloque:
            bloque_id = bloque.id

    # Verificar que no exista ya check-in para este bloque hoy
    q_existe = select(Asistencia).where(
        Asistencia.empleado_id == empleado_id,
        Asistencia.fecha == hoy,
    )
    if bloque_id:
        q_existe = q_existe.where(Asistencia.bloque_id == bloque_id)
    else:
        q_existe = q_existe.where(Asistencia.bloque_id == None)

    r = await db.execute(q_existe)
    if r.scalars().first():
        bloque_desc = f" (bloque {bloque.orden})" if bloque else ""
        raise HTTPException(400, f"El empleado ya registró entrada hoy{bloque_desc}")

    # Detectar tardanza
    estado = "presente"
    if bloque and turno:
        tolerancia = turno.tolerancia_min or 10
        hora_limite = (datetime.combine(hoy, bloque.hora_inicio) + timedelta(minutes=tolerancia)).time()
        if ahora > hora_limite:
            estado = "tarde"
    elif turno:
        # Turno corrido sin bloques: usar hora_entrada del turno
        tolerancia = turno.tolerancia_min or 10
        hora_limite = (datetime.combine(hoy, turno.hora_entrada) + timedelta(minutes=tolerancia)).time()
        if ahora > hora_limite:
            estado = "tarde"

    nueva = Asistencia(
        empleado_id=empleado_id,
        turno_id=turno_id,
        bloque_id=bloque_id,
        fecha=hoy,
        hora_entrada=ahora,
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
    bloque_id: int | None = None,
    observacion: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """
    Registra salida del empleado.
    - Si el empleado tiene turno cortado, cierra el bloque abierto más reciente.
    - Se puede pasar bloque_id explícitamente para cerrar un bloque específico.
    """
    hoy = date.today()

    q = select(Asistencia).where(
        Asistencia.empleado_id == empleado_id,
        Asistencia.fecha == hoy,
        Asistencia.hora_salida == None,
    )
    if bloque_id:
        q = q.where(Asistencia.bloque_id == bloque_id)
    q = q.order_by(Asistencia.hora_entrada.desc())

    r = await db.execute(q)
    asistencia = r.scalars().first()
    if not asistencia:
        raise HTTPException(404, "No se encontró registro de entrada abierto para hoy")

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
