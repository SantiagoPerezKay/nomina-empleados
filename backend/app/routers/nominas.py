from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import Nomina, NominaDetalle, PeriodoNomina, Contrato, EventoEmpleado, ConceptoNomina
from app.models.usuario import Usuario
from app.schemas.schemas import NominaCreate, NominaUpdate, NominaOut, NominaDetalleCreate, NominaDetalleOut


class GenerarBorradorReq(BaseModel):
    empleado_id: int
    periodo_id: int


router = APIRouter(prefix="/nominas", tags=["Nóminas"])


def _calcular_totales(detalles: list[NominaDetalle]):
    ingresos = sum(d.monto_total for d in detalles if d.tipo == "ingreso" and d.monto_total)
    deducciones = sum(d.monto_total for d in detalles if d.tipo == "deduccion" and d.monto_total)
    return ingresos, deducciones, ingresos - deducciones


async def _recalcular_y_guardar(nomina: Nomina, db: AsyncSession):
    r = await db.execute(select(NominaDetalle).where(NominaDetalle.nomina_id == nomina.id))
    detalles = r.scalars().all()
    ingresos, deducciones, neto = _calcular_totales(detalles)
    nomina.total_ingresos = ingresos
    nomina.total_deducciones = deducciones
    nomina.neto_a_pagar = neto
    await db.commit()
    await db.refresh(nomina)


@router.post("/generar-borrador", response_model=NominaOut, status_code=201)
async def generar_borrador(
    body: GenerarBorradorReq,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    periodo = await db.get(PeriodoNomina, body.periodo_id)
    if not periodo:
        raise HTTPException(404, "Período no encontrado")
    if periodo.cerrado:
        raise HTTPException(400, "No se puede generar borrador en un período cerrado")

    r_contrato = await db.execute(
        select(Contrato).where(Contrato.empleado_id == body.empleado_id, Contrato.activo == True)
    )
    contrato = r_contrato.scalars().first()
    if not contrato:
        raise HTTPException(400, "Empleado no tiene contrato activo")

    salario_base = contrato.salario_mensual or 0

    nomina = Nomina(
        empleado_id=body.empleado_id,
        contrato_id=contrato.id,
        periodo_id=body.periodo_id,
        salario_base=salario_base,
        observacion="Borrador autogenerado",
    )
    db.add(nomina)
    await db.flush()

    detalles = []

    # Concepto sueldo base
    r_cs = await db.execute(select(ConceptoNomina).where(ConceptoNomina.codigo == "salario_base"))
    concepto_sueldo = r_cs.scalars().first()
    c_id = concepto_sueldo.id if concepto_sueldo else 1

    det_base = NominaDetalle(
        nomina_id=nomina.id, concepto_id=c_id, tipo="ingreso",
        cantidad=1, monto_unitario=salario_base, monto_total=salario_base,
        observacion="Sueldo base",
    )
    db.add(det_base)
    detalles.append(det_base)

    # Descuentos por eventos no justificados aprobados en el período
    r_ev = await db.execute(
        select(EventoEmpleado).where(
            EventoEmpleado.empleado_id == body.empleado_id,
            EventoEmpleado.fecha_inicial >= periodo.fecha_inicio,
            EventoEmpleado.fecha_inicial <= periodo.fecha_fin,
            EventoEmpleado.justificado == False,
            EventoEmpleado.estado == "aprobado",
        )
    )
    eventos = r_ev.scalars().all()

    r_desc = await db.execute(select(ConceptoNomina).where(ConceptoNomina.codigo == "ausencia_desc"))
    concepto_desc = r_desc.scalars().first()
    desc_id = concepto_desc.id if concepto_desc else 2
    valor_dia = float(salario_base) / 30 if salario_base else 0

    for ev in eventos:
        det_desc = NominaDetalle(
            nomina_id=nomina.id, concepto_id=desc_id, tipo="deduccion",
            cantidad=1, monto_unitario=valor_dia, monto_total=valor_dia,
            evento_id=ev.id, observacion="Descuento por evento no justificado",
        )
        db.add(det_desc)
        detalles.append(det_desc)

    await db.flush()
    ingresos, deducciones, neto = _calcular_totales(detalles)
    nomina.total_ingresos = ingresos
    nomina.total_deducciones = deducciones
    nomina.neto_a_pagar = neto

    await db.commit()
    await db.refresh(nomina)
    return nomina


@router.get("", response_model=list[NominaOut])
async def listar(
    periodo_id: int | None = None,
    empleado_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Nomina)
    if periodo_id:
        q = q.where(Nomina.periodo_id == periodo_id)
    if empleado_id:
        q = q.where(Nomina.empleado_id == empleado_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{id}", response_model=NominaOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    return n


@router.post("", response_model=NominaOut, status_code=201)
async def crear(
    body: NominaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    periodo = await db.get(PeriodoNomina, body.periodo_id)
    if not periodo:
        raise HTTPException(404, "Período no encontrado")
    if periodo.cerrado:
        raise HTTPException(400, "No se puede crear nómina en un período cerrado")

    nomina = Nomina(
        empleado_id=body.empleado_id,
        contrato_id=body.contrato_id,
        periodo_id=body.periodo_id,
        salario_base=body.salario_base,
        observacion=body.observacion,
    )
    db.add(nomina)
    await db.flush()

    detalles = []
    for d in body.detalles:
        detalle = NominaDetalle(nomina_id=nomina.id, **d.model_dump())
        db.add(detalle)
        detalles.append(detalle)

    await db.flush()
    ingresos, deducciones, neto = _calcular_totales(detalles)
    nomina.total_ingresos = ingresos
    nomina.total_deducciones = deducciones
    nomina.neto_a_pagar = neto

    await db.commit()
    await db.refresh(nomina)
    return nomina


@router.put("/{id}", response_model=NominaOut)
async def actualizar(
    id: int,
    body: NominaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    periodo = await db.get(PeriodoNomina, n.periodo_id)
    if periodo and periodo.cerrado:
        raise HTTPException(400, "No se puede modificar una nómina de período cerrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(n, k, v)
    await db.commit()
    await db.refresh(n)
    return n


@router.delete("/{id}", status_code=204)
async def eliminar(
    id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    periodo = await db.get(PeriodoNomina, n.periodo_id)
    if periodo and periodo.cerrado:
        raise HTTPException(400, "No se puede eliminar una nómina de período cerrado")
    await db.delete(n)
    await db.commit()


@router.get("/{id}/detalles", response_model=list[NominaDetalleOut])
async def listar_detalles(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    r = await db.execute(select(NominaDetalle).where(NominaDetalle.nomina_id == id))
    return r.scalars().all()


@router.post("/{id}/detalles", response_model=NominaDetalleOut, status_code=201)
async def agregar_detalle(
    id: int,
    body: NominaDetalleCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    periodo = await db.get(PeriodoNomina, n.periodo_id)
    if periodo and periodo.cerrado:
        raise HTTPException(400, "Período cerrado")

    det = NominaDetalle(nomina_id=id, **body.model_dump())
    db.add(det)
    await db.flush()
    await _recalcular_y_guardar(n, db)
    await db.refresh(det)
    return det


@router.delete("/{id}/detalles/{det_id}", status_code=204)
async def eliminar_detalle(
    id: int,
    det_id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    periodo = await db.get(PeriodoNomina, n.periodo_id)
    if periodo and periodo.cerrado:
        raise HTTPException(400, "Período cerrado")
    det = await db.get(NominaDetalle, det_id)
    if not det or det.nomina_id != id:
        raise HTTPException(404, "Detalle no encontrado en esta nómina")
    await db.delete(det)
    await db.flush()
    await _recalcular_y_guardar(n, db)


@router.post("/{id}/recalcular", response_model=NominaOut)
async def recalcular(
    id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    await _recalcular_y_guardar(n, db)
    return n
