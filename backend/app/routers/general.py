from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import (
    AsignacionTurno, BloqueHorario, CategoriaEgreso, CategoriaEvento,
    ConceptoContrato, ConceptoNomina, Contrato, Departamento, Encargado,
    Feriado, HorasExtras, PeriodoNomina, Sucursal, Turno,
)
from app.models.usuario import Usuario
from app.schemas.schemas import (
    AsignacionTurnoCreate, AsignacionTurnoOut,
    BloqueHorarioCreate, BloqueHorarioOut, BloqueHorarioUpdate,
    CategoriaEgresoCreate, CategoriaEgresoOut,
    CategoriaEventoCreate, CategoriaEventoOut,
    ConceptoContratoCreate, ConceptoContratoOut, ConceptosContratoBulk,
    ConceptoNominaCreate, ConceptoNominaOut,
    ContratoCreate, ContratoOut, ContratoUpdate,
    DepartamentoCreate, DepartamentoOut, DepartamentoUpdate,
    EncargadoCreate, EncargadoOut, EncargadoUpdate,
    FeriadoCreate, FeriadoOut, FeriadoUpdate,
    HorasExtrasCreate, HorasExtrasOut, HorasExtrasUpdate,
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

# ── Rutas /asignaciones/* primero (antes de /{id} para evitar ambigüedad en FastAPI) ──

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
    # Validar que el turno destino exista
    turno_nuevo = await db.get(Turno, body.turno_id)
    if not turno_nuevo:
        raise HTTPException(404, "Turno no encontrado")

    # Traer todas las asignaciones existentes del empleado
    r_exist = await db.execute(
        select(AsignacionTurno).where(AsignacionTurno.empleado_id == body.empleado_id)
    )
    existentes = r_exist.scalars().all()

    def _rangos_fechas_solapan(d1_ini, d1_fin, d2_ini, d2_fin) -> bool:
        """Dos rangos [d_ini, d_fin] solapan si d1_ini <= d2_fin y d2_ini <= d1_fin.
        fin=None significa 'abierto' (se trata como infinito)."""
        if d1_fin is None and d2_fin is None:
            return True
        if d1_fin is None:
            return d1_ini <= d2_fin
        if d2_fin is None:
            return d2_ini <= d1_fin
        return d1_ini <= d2_fin and d2_ini <= d1_fin

    def _dias_solapan(d1, d2) -> bool:
        """dia_semana solapa si son iguales, o alguno es None (=todos los días)."""
        return d1 is None or d2 is None or d1 == d2

    def _horas_solapan(t1_ini, t1_fin, t2_ini, t2_fin) -> bool:
        """Turnos cruzan medianoche si fin <= ini; para simplicidad comparamos como
        intervalos [ini, fin). Si cruza medianoche, lo tratamos como (ini→24) ∪ (0→fin)."""
        def _intervalos(ini, fin):
            if fin <= ini:  # cruza medianoche
                return [(ini, datetime.max.time().replace(hour=23, minute=59, second=59)),
                        (datetime.min.time(), fin)]
            return [(ini, fin)]
        for a_ini, a_fin in _intervalos(t1_ini, t1_fin):
            for b_ini, b_fin in _intervalos(t2_ini, t2_fin):
                if a_ini < b_fin and b_ini < a_fin:
                    return True
        return False

    for ex in existentes:
        # ¿Los rangos de fecha se pisan?
        if not _rangos_fechas_solapan(
            body.fecha_desde, body.fecha_hasta, ex.fecha_desde, ex.fecha_hasta
        ):
            continue
        # ¿Comparten día de la semana?
        if not _dias_solapan(body.dia_semana, ex.dia_semana):
            continue
        # ¿Las horas del turno se pisan?
        turno_ex = await db.get(Turno, ex.turno_id)
        if not turno_ex:
            continue
        if _horas_solapan(
            turno_nuevo.hora_entrada, turno_nuevo.hora_salida,
            turno_ex.hora_entrada, turno_ex.hora_salida,
        ):
            raise HTTPException(
                400,
                f"El horario se superpone con otra asignación del empleado: "
                f"'{turno_ex.nombre}' ({turno_ex.hora_entrada.strftime('%H:%M')}-"
                f"{turno_ex.hora_salida.strftime('%H:%M')})."
            )

    a = AsignacionTurno(**body.model_dump())
    db.add(a); await db.commit(); await db.refresh(a); return a

@turnos_router.delete("/asignaciones/{id}", status_code=204)
async def eliminar_asignacion(id: int, db: AsyncSession = Depends(get_db),
                               _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    a = await db.get(AsignacionTurno, id)
    if not a: raise HTTPException(404, "Asignación no encontrada")
    await db.delete(a); await db.commit()

# ── Rutas genéricas /{id} después de todas las rutas específicas ───────────────

@turnos_router.delete("/{id}", status_code=204)
async def eliminar_turno(id: int, db: AsyncSession = Depends(get_db),
                          _=Depends(require_roles("superadmin", "admin", "rrhh"))):
    t = await db.get(Turno, id)
    if not t: raise HTTPException(404, "Turno no encontrado")
    t.activo = False; await db.commit()

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
    data = body.model_dump()
    # Calcular tarifa_hora automáticamente para contratos mensuales
    if data.get("tipo_contrato") == "mensual" and data.get("salario_mensual") and data.get("hs_semanales"):
        hs_mes = data["hs_semanales"] * Decimal("4.33")
        data["tarifa_hora"] = round(data["salario_mensual"] / hs_mes, 2)
    c = Contrato(**data)
    db.add(c); await db.commit(); await db.refresh(c); return c

@contratos_router.put("/{id}", response_model=ContratoOut)
async def actualizar_contrato(id: int, body: ContratoUpdate, db: AsyncSession = Depends(get_db),
                               _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador"))):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(c, k, v)
    # Recalcular tarifa_hora si cambió salario o hs_semanales
    if c.tipo_contrato == "mensual" and c.salario_mensual and c.hs_semanales:
        hs_mes = c.hs_semanales * Decimal("4.33")
        c.tarifa_hora = round(c.salario_mensual / hs_mes, 2)
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


# ─── CONCEPTOS POR CONTRATO ──────────────────────────────────────────────────

@contratos_router.get("/{id}/conceptos", response_model=list[ConceptoNominaOut])
async def listar_conceptos_contrato(id: int, db: AsyncSession = Depends(get_db),
                                     _=Depends(get_current_user)):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    r = await db.execute(
        select(ConceptoNomina)
        .join(ConceptoContrato, ConceptoContrato.concepto_id == ConceptoNomina.id)
        .where(ConceptoContrato.contrato_id == id)
        .order_by(ConceptoNomina.tipo, ConceptoNomina.nombre)
    )
    return r.scalars().all()

@contratos_router.put("/{id}/conceptos", response_model=list[ConceptoNominaOut])
async def reemplazar_conceptos_contrato(
    id: int, body: ConceptosContratoBulk,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador")),
):
    """Reemplaza todos los conceptos asignados al contrato de una sola vez."""
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    # Borrar actuales
    existing = await db.execute(
        select(ConceptoContrato).where(ConceptoContrato.contrato_id == id)
    )
    for cc in existing.scalars().all():
        await db.delete(cc)
    # Insertar nuevos
    for cid in body.concepto_ids:
        db.add(ConceptoContrato(contrato_id=id, concepto_id=cid))
    await db.commit()
    # Devolver la lista completa
    r = await db.execute(
        select(ConceptoNomina)
        .join(ConceptoContrato, ConceptoContrato.concepto_id == ConceptoNomina.id)
        .where(ConceptoContrato.contrato_id == id)
        .order_by(ConceptoNomina.tipo, ConceptoNomina.nombre)
    )
    return r.scalars().all()

@contratos_router.post("/{id}/conceptos", response_model=ConceptoContratoOut, status_code=201)
async def agregar_concepto_contrato(id: int, body: ConceptoContratoCreate,
                                     db: AsyncSession = Depends(get_db),
                                     _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador"))):
    c = await db.get(Contrato, id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    cn = await db.get(ConceptoNomina, body.concepto_id)
    if not cn: raise HTTPException(404, "Concepto no encontrado")
    # Verificar duplicado
    r = await db.execute(
        select(ConceptoContrato).where(
            ConceptoContrato.contrato_id == id,
            ConceptoContrato.concepto_id == body.concepto_id,
        )
    )
    if r.scalar_one_or_none():
        raise HTTPException(400, "Este concepto ya está asignado al contrato")
    cc = ConceptoContrato(contrato_id=id, concepto_id=body.concepto_id)
    db.add(cc); await db.commit(); await db.refresh(cc); return cc

@contratos_router.delete("/{id}/conceptos/{concepto_id}", status_code=204)
async def quitar_concepto_contrato(id: int, concepto_id: int,
                                    db: AsyncSession = Depends(get_db),
                                    _=Depends(require_roles("superadmin", "admin", "rrhh", "liquidador"))):
    r = await db.execute(
        select(ConceptoContrato).where(
            ConceptoContrato.contrato_id == id,
            ConceptoContrato.concepto_id == concepto_id,
        )
    )
    cc = r.scalar_one_or_none()
    if not cc: raise HTTPException(404, "Concepto no asignado a este contrato")
    await db.delete(cc); await db.commit()


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


# ─── HORAS EXTRAS ─────────────────────────────────────────────────────────────

hs_extras_router = APIRouter(prefix="/horas-extras", tags=["Horas Extras"])

@hs_extras_router.get("", response_model=list[HorasExtrasOut])
async def listar_hs_extras(
    empleado_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(HorasExtras).order_by(HorasExtras.fecha.desc())
    if empleado_id:
        q = q.where(HorasExtras.empleado_id == empleado_id)
    r = await db.execute(q)
    return r.scalars().all()

@hs_extras_router.post("", response_model=HorasExtrasOut, status_code=201)
async def crear_hs_extras(
    body: HorasExtrasCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin", "liquidador")),
):
    if body.porcentaje not in (50, 100):
        raise HTTPException(400, "El porcentaje debe ser 50 o 100")
    he = HorasExtras(**body.model_dump())
    db.add(he)
    await db.commit()
    await db.refresh(he)
    return he

@hs_extras_router.put("/{id}", response_model=HorasExtrasOut)
async def actualizar_hs_extras(
    id: int,
    body: HorasExtrasUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin", "liquidador")),
):
    he = await db.get(HorasExtras, id)
    if not he: raise HTTPException(404, "Registro no encontrado")
    if body.porcentaje is not None and body.porcentaje not in (50, 100):
        raise HTTPException(400, "El porcentaje debe ser 50 o 100")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(he, k, v)
    await db.commit()
    await db.refresh(he)
    return he

@hs_extras_router.delete("/{id}", status_code=204)
async def eliminar_hs_extras(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("superadmin", "admin", "liquidador")),
):
    he = await db.get(HorasExtras, id)
    if not he: raise HTTPException(404, "Registro no encontrado")
    await db.delete(he)
    await db.commit()
