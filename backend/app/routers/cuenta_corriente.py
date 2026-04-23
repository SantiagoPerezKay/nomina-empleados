from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import CuentaCorriente, Empleado
from app.models.usuario import Usuario
from app.schemas.schemas import CuentaCorrienteCreate, CuentaCorrienteOut

router = APIRouter(prefix="/cuenta-corriente", tags=["Cuenta Corriente"])


async def _enrich(cc: CuentaCorriente, db: AsyncSession) -> dict:
    data = {c.name: getattr(cc, c.name) for c in cc.__table__.columns}
    # Nombre del usuario que cargó el movimiento
    created_by_nombre = None
    if cc.created_by_id:
        u = await db.get(Usuario, cc.created_by_id)
        if u:
            if u.empleado_id:
                emp = await db.get(Empleado, u.empleado_id)
                if emp:
                    created_by_nombre = f"{emp.apellido}, {emp.nombre}"
            if not created_by_nombre:
                created_by_nombre = u.email
    data["created_by_nombre"] = created_by_nombre
    return data


@router.get("", response_model=list[CuentaCorrienteOut])
async def listar(
    empleado_id: int | None = None,
    solo_pendientes: bool = False,   # True = solo sin nomina_id (no descontados aún)
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(CuentaCorriente)
    if empleado_id:
        q = q.where(CuentaCorriente.empleado_id == empleado_id)
    if solo_pendientes:
        q = q.where(CuentaCorriente.nomina_id == None)
    q = q.order_by(CuentaCorriente.fecha.desc()).offset(skip).limit(limit)
    r = await db.execute(q)
    return [await _enrich(cc, db) for cc in r.scalars().all()]


@router.post("", response_model=CuentaCorrienteOut, status_code=201)
async def crear(
    body: CuentaCorrienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin", "rrhh", "liquidador")),
):
    emp = await db.get(Empleado, body.empleado_id)
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    if float(body.monto) <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")

    cc = CuentaCorriente(**body.model_dump(), created_by_id=current_user.id)
    db.add(cc)
    await db.commit()
    await db.refresh(cc)
    return await _enrich(cc, db)


@router.delete("/{id}", status_code=204)
async def eliminar(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador")),
):
    cc = await db.get(CuentaCorriente, id)
    if not cc:
        raise HTTPException(404, "Movimiento no encontrado")
    if cc.nomina_id:
        raise HTTPException(400, "No se puede eliminar: ya fue descontado en una nómina")
    await db.delete(cc)
    await db.commit()
