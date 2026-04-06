from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import (
    AsignacionTurno, BloqueHorario, CategoriaEgreso, CategoriaEvento,
    ConceptoNomina, Contrato, Departamento, Encargado, Feriado,
    PeriodoNomina, Sucursal, Turno,
)
from app.models.usuario import Usuario
from app.schemas.schemas import (
    AsignacionTurnoCreate, AsignacionTurnoOut,
    BloqueHorarioCreate, BloqueHorarioOut, BloqueHorarioUpdate,
    CategoriaEgresoCreate, CategoriaEgresoOut,
    CategoriaEventoCreate, CategoriaEventoOut,
    ConceptoNominaCreate, ConceptoNominaOut,
    ContratoCreate, ContratoOut, ContratoUpdate,
    DepartamentoCreate, DepartamentoOut, DepartamentoUpdate,
    EncargadoCreate, EncargadoOut, EncargadoUpdate,
    FeriadoCreate, FeriadoOut, FeriadoUpdate,
    PeriodoNominaCreate, PeriodoNominaOut,
    SucursalCreate, SucursalOut, SucursalUpdate,
    TurnoCreate, TurnoOut, TurnoUpdate,
)

# ─── SUCURSALES ───────────────────────────────────────────────────────────────

sucursales_router = APIRouter(prefix="/sucursales", tags=["Sucursales"])

@sucursales_router.get("", response_model=list[SucursalOut])
async def listar_sucursales(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Sucursal).order_by(Sucursal.nombre))
    return r.scalars().all()

@sucursales_router.get("/{id}", response_model=SucursalOut)
async def obtener_sucursal(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    s = await db.get(Sucursal, id)
    if not s: raise HTTPException(404, "Sucursal no encontrada")
    return s

@sucursales_router.post("", response_model=SucursalOut, status_code=201)
async def crear_sucursal(body: SucursalCreate, db: AsyncSession = Depends(get_db),
                         _=Depends(require_roles("superadmin", "admin"))):
    s = Sucursal(**body.model_dump())
    db.add(s); await db.commit(); await db.refresh(s); return s

@sucursales_router.put("/{id}", response_model=SucursalOut)
async def actualizar_sucursal(id: int, body: SucursalUpdate, db: AsyncSession = Depends(get_db),
                               _=Depends(require_roles("superadmin", "admin"))):
    s = await db.get(Sucursal, id)
    if not s: raise HTTPException(404, "Sucursal no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(s, k, v)
    await db.commit(); await db.refresh(s); return s

@sucursales_router.delete("/{id}", status_code=204)
async def eliminar_sucursal(id: int, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin"))):
    s = await db.get(Sucursal, id)
    if not s: raise HTTPException(404, "Sucursal no encontrada")
    s.activo = False; await db.commit()


# ─── DEPARTAMENTOS ────────────────────────────────────────────────────────────

departamentos_router = APIRouter(prefix="/departamentos", tags=["Departamentos"])

@departamentos_router.get("", response_model=list[DepartamentoOut])
async def listar_departamentos(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Departamento).order_by(Departamento.nombre))
    return r.scalars().all()

@departamentos_router.post("", response_model=DepartamentoOut, status_code=201)
async def crear_departamento(body: DepartamentoCreate, db: AsyncSession = Depends(get_db),
                              _=Depends(require_roles("superadmin", "admin"))):
    d = Departamento(**body.model_dump())
    db.add(d); await db.commit(); await db.refresh(d); return d

@departamentos_router.put("/{id}", response_model=DepartamentoOut)
async def actualizar_departamento(id: int, body: DepartamentoUpdate, db: AsyncSession = Depends(get_db),
                                   _=Depends(require_roles("superadmin", "admin"))):
    d = await db.get(Departamento, id)
    if not d: raise HTTPException(404, "Departamento no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(d, k, v)
    await db.commit(); await db.refresh(d); return d

@departamentos_router.delete("/{id}", status_code=204)
async def eliminar_departamento(id: int, db: AsyncSession = Depends(get_db),
                                _=Depends(require_roles("superadmin", "admin"))):
    d = await db.get(Departamento, id)
    if not d: raise HTTPException(404, "Departamento no encontrado")
    d.activo = False; await db.commit()


# ─── CATEGORIAS EGRESO ────────────────────────────────────────────────────────

cat_egreso_router = APIRouter(prefix="/categorias-egreso", tags=["Categorías Egreso"])

@cat_egreso_router.get("", response_model=list[CategoriaEgresoOut])
async def listar_cat_egreso(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(CategoriaEgreso).where(CategoriaEgreso.activo == True))
    return r.scalars().all()

@cat_egreso_router.post("", response_model=CategoriaEgresoOut, status_code=201)
async def crear_cat_egreso(body: CategoriaEgresoCreate, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin"))):
    c = CategoriaEgreso(**body.model_dump())
    db.add(c); await db.commit(); await db.refresh(c); return c


# ─── TURNOS ───────────────────────────────────────────────────────────────────

turnos_router = APIRouter(prefix="/turnos", tags=["Turnos"])

@turnos_router.get("", response_model=list[TurnoOut])
async def listar_turnos(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Turno).where(Turno.activo == True))
    return r.scalars().all()

@turnos_router.post("", response_model=TurnoOut, status_code=201)
async def crear_turno(body: TurnoCreate, db: AsyncSession = Depends(get_db),
                      _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    t = Turno(**body.model_dump())
    db.add(t); await db.commit(); await db.refresh(t); return t

@turnos_router.put("/{id}", response_model=TurnoOut)
async def actualizar_turno(id: int, body: TurnoUpdate, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    t = await db.get(Turno, id)
    if not t: raise HTTPException(404, "Turno no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(t, k, v)
    await db.commit(); await db.refresh(t); return t

@turnos_router.get("/asignaciones", response_model=list[AsignacionTurnoOut])
async def listar_asignaciones(
    empleado_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(AsignacionTurno)
    if empleado_id:
        q = q.where(AsignacionTurno.empleado_id == empleado_id)
    q = q.order_by(AsignacionTurno.fecha_desde.desc())
    r = await db.execute(q)
    return r.scalars().all()

@turnos_router.post("/asignaciones", response_model=AsignacionTurnoOut, status_code=201)
async def asignar_turno(body: AsignacionTurnoCreate, db: AsyncSession = Depends(get_db),
                         _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    a = AsignacionTurno(**body.model_dump())
    db.add(a); await db.commit(); await db.refresh(a); return a

@turnos_router.delete("/asignaciones/{id}", status_code=204)
async def eliminar_asignacion(id: int, db: AsyncSession = Depends(get_db),
                               _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    a = await db.get(AsignacionTurno, id)
    if not a: raise HTTPException(404, "Asignación no encontrada")
    await db.delete(a); await db.commit()

@turnos_router.get("/{turno_id}/bloques", response_model=list[BloqueHorarioOut])
async def listar_bloques(turno_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    t = await db.get(Turno, turno_id)
    if not t: raise HTTPException(404, "Turno no encontrado")
    r = await db.execute(select(BloqueHorario).where(BloqueHorario.turno_id == turno_id).order_by(BloqueHorario.orden))
    return r.scalars().all()

@turnos_router.post("/{turno_id}/bloques", response_model=BloqueHorarioOut, status_code=201)
async def crear_bloque(turno_id: int, body: BloqueHorarioCreate, db: AsyncSession = Depends(get_db),
                        _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    t = await db.get(Turno, turno_id)
    if not t: raise HTTPException(404, "Turno no encontrado")
    b = BloqueHorario(turno_id=turno_id, **body.model_dump())
    db.add(b); await db.commit(); await db.refresh(b); return b

@turnos_router.put("/{turno_id}/bloques/{id}", response_model=BloqueHorarioOut)
async def actualizar_bloque(turno_id: int, id: int, body: BloqueHorarioUpdate,
                             db: AsyncSession = Depends(get_db), _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    b = await db.get(BloqueHorario, id)
    if not b or b.turno_id != turno_id: raise HTTPException(404, "Bloque no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(b, k, v)
    await db.commit(); await db.refresh(b); return b

@turnos_router.delete("/{turno_id}/bloques/{id}", status_code=204)
async def eliminar_bloque(turno_id: int, id: int, db: AsyncSession = Depends(get_db),
                           _=Depends(require_roles("superadmin", "admin"))):
    b = await db.get(BloqueHorario, id)
    if not b or b.turno_id != turno_id: raise HTTPException(404, "Bloque no encontrado")
    await db.delete(b); await db.commit()


# ─── CONTRATOS ────────────────────────────────────────────────────────────────

contratos_router = APIRouter(prefix="/contratos", tags=["Contratos"])

@contratos_router.get("/empleado/{empleado_id}", response_model=list[ContratoOut])
async def contratos_por_empleado(empleado_id: int, db: AsyncSession = Depends(get_db),
                                  _=Depends(get_current_user)):
    r = await db.execute(select(Contrato).where(Contrato.empleado_id == empleado_id)
                         .order_by(Contrato.fecha_inicio.desc()))
    return r.scalars().all()

@contratos_router.get("/{id}", response_model=ContratoOut)
async def obtener_contrato(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    return c

@contratos_router.post("", response_model=ContratoOut, status_code=201)
async def crear_contrato(body: ContratoCreate, db: AsyncSession = Depends(get_db),
                          _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador"))):
    c = Contrato(**body.model_dump())
    db.add(c); await db.commit(); await db.refresh(c); return c

@contratos_router.put("/{id}", response_model=ContratoOut)
async def actualizar_contrato(id: int, body: ContratoUpdate, db: AsyncSession = Depends(get_db),
                               _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador"))):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(c, k, v)
    await db.commit(); await db.refresh(c); return c

@contratos_router.post("/{id}/cerrar", response_model=ContratoOut)
async def cerrar_contrato(id: int, db: AsyncSession = Depends(get_db),
                           _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    if not c.activo: raise HTTPException(400, "El contrato ya está cerrado")
    c.activo = False
    c.fecha_fin = date.today()
    await db.commit(); await db.refresh(c); return c

@contratos_router.delete("/{id}", status_code=204)
async def eliminar_contrato(id: int, db: AsyncSession = Depends(get_db),
                             _=Depends(require_roles("superadmin", "admin"))):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    c.activo = False; await db.commit()


# ─── CONCEPTOS NOMINA ─────────────────────────────────────────────────────────

conceptos_router = APIRouter(prefix="/conceptos-nomina", tags=["Conceptos Nómina"])

@conceptos_router.get("", response_model=list[ConceptoNominaOut])
async def listar_conceptos(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(ConceptoNomina).where(ConceptoNomina.activo == True))
    return r.scalars().all()

@conceptos_router.post("", response_model=ConceptoNominaOut, status_code=201)
async def crear_concepto(body: ConceptoNominaCreate, db: AsyncSession = Depends(get_db),
                          _=Depends(require_roles("superadmin", "admin", "liquidador"))):
    c = ConceptoNomina(**body.model_dump())
    db.add(c); await db.commit(); await db.refresh(c); return c

@conceptos_router.delete("/{id}", status_code=204)
async def eliminar_concepto(id: int, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin", "liquidador"))):
    c = await db.get(ConceptoNomina, id)
    if not c: raise HTTPException(404, "Concepto no encontrado")
    c.activo = False; await db.commit()


# ─── PERIODOS NOMINA ──────────────────────────────────────────────────────────

periodos_router = APIRouter(prefix="/periodos-nomina", tags=["Períodos Nómina"])

@periodos_router.get("", response_model=list[PeriodoNominaOut])
async def listar_periodos(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(PeriodoNomina).order_by(PeriodoNomina.fecha_inicio.desc()))
    return r.scalars().all()

@periodos_router.post("", response_model=PeriodoNominaOut, status_code=201)
async def crear_periodo(body: PeriodoNominaCreate, db: AsyncSession = Depends(get_db),
                         _=Depends(require_roles("superadmin", "admin", "liquidador"))):
    p = PeriodoNomina(**body.model_dump())
    db.add(p); await db.commit(); await db.refresh(p); return p

@periodos_router.post("/{id}/cerrar", response_model=PeriodoNominaOut)
async def cerrar_periodo(id: int, db: AsyncSession = Depends(get_db),
                          current_user: Usuario = Depends(require_roles("superadmin", "liquidador"))):
    from datetime import datetime
    p = await db.get(PeriodoNomina, id)
    if not p: raise HTTPException(404, "Período no encontrado")
    if p.cerrado: raise HTTPException(400, "El período ya está cerrado")
    p.cerrado = True
    p.cerrado_por = current_user.id
    p.cerrado_at = datetime.utcnow()
    await db.commit(); await db.refresh(p); return p


# ─── CATEGORIAS EVENTO ────────────────────────────────────────────────────────

cat_evento_router = APIRouter(prefix="/categorias-evento", tags=["Categorías Evento"])

@cat_evento_router.get("", response_model=list[CategoriaEventoOut])
async def listar_cat_evento(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(CategoriaEvento).where(CategoriaEvento.activo == True))
    return r.scalars().all()

@cat_evento_router.post("", response_model=CategoriaEventoOut, status_code=201)
async def crear_cat_evento(body: CategoriaEventoCreate, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin"))):
    c = CategoriaEvento(**body.model_dump())
    db.add(c); await db.commit(); await db.refresh(c); return c

@cat_evento_router.delete("/{id}", status_code=204)
async def eliminar_cat_evento(id: int, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin"))):
    c = await db.get(CategoriaEvento, id)
    if not c: raise HTTPException(404, "Categoría no encontrada")
    c.activo = False; await db.commit()


# ─── ENCARGADOS ───────────────────────────────────────────────────────────────

encargados_router = APIRouter(prefix="/encargados", tags=["Encargados"])

@encargados_router.get("", response_model=list[EncargadoOut])
async def listar_encargados(sucursal_id: int | None = None, db: AsyncSession = Depends(get_db),
                             _=Depends(get_current_user)):
    q = select(Encargado).where(Encargado.activo == True)
    if sucursal_id: q = q.where(Encargado.sucursal_id == sucursal_id)
    r = await db.execute(q)
    return r.scalars().all()

@encargados_router.get("/{id}", response_model=EncargadoOut)
async def obtener_encargado(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    e = await db.get(Encargado, id)
    if not e: raise HTTPException(404, "Encargado no encontrado")
    return e

@encargados_router.post("", response_model=EncargadoOut, status_code=201)
async def crear_encargado(body: EncargadoCreate, db: AsyncSession = Depends(get_db),
                           _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    e = Encargado(**body.model_dump())
    db.add(e); await db.commit(); await db.refresh(e); return e

@encargados_router.put("/{id}", response_model=EncargadoOut)
async def actualizar_encargado(id: int, body: EncargadoUpdate, db: AsyncSession = Depends(get_db),
                                _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    e = await db.get(Encargado, id)
    if not e: raise HTTPException(404, "Encargado no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(e, k, v)
    await db.commit(); await db.refresh(e); return e

@encargados_router.delete("/{id}", status_code=204)
async def desactivar_encargado(id: int, db: AsyncSession = Depends(get_db),
                                _=Depends(require_roles("superadmin", "admin"))):
    e = await db.get(Encargado, id)
    if not e: raise HTTPException(404, "Encargado no encontrado")
    e.activo = False; await db.commit()


# ─── FERIADOS ─────────────────────────────────────────────────────────────────

feriados_router = APIRouter(prefix="/feriados", tags=["Feriados"])

@feriados_router.get("", response_model=list[FeriadoOut])
async def listar_feriados(
    anio: int | None = Query(None, alias="año"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Feriado).order_by(Feriado.fecha)
    if anio:
        from sqlalchemy import extract
        q = q.where(extract("year", Feriado.fecha) == anio)
    r = await db.execute(q)
    return r.scalars().all()

@feriados_router.get("/{id}", response_model=FeriadoOut)
async def obtener_feriado(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    f = await db.get(Feriado, id)
    if not f: raise HTTPException(404, "Feriado no encontrado")
    return f

@feriados_router.post("", response_model=FeriadoOut, status_code=201)
async def crear_feriado(body: FeriadoCreate, db: AsyncSession = Depends(get_db),
                         _=Depends(require_roles("superadmin", "admin"))):
    f = Feriado(**body.model_dump())
    db.add(f); await db.commit(); await db.refresh(f); return f

@feriados_router.put("/{id}", response_model=FeriadoOut)
async def actualizar_feriado(id: int, body: FeriadoUpdate, db: AsyncSession = Depends(get_db),
                              _=Depends(require_roles("superadmin", "admin"))):
    f = await db.get(Feriado, id)
    if not f: raise HTTPException(404, "Feriado no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(f, k, v)
    await db.commit(); await db.refresh(f); return f

@feriados_router.delete("/{id}", status_code=204)
async def eliminar_feriado(id: int, db: AsyncSession = Depends(get_db),
                            _=Depends(require_roles("superadmin", "admin"))):
    f = await db.get(Feriado, id)
    if not f: raise HTTPException(404, "Feriado no encontrado")
    await db.delete(f); await db.commit()
