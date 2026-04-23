import logging
from datetime import date, datetime, time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import (
    Nomina, NominaDetalle, PeriodoNomina, Contrato, Empleado,
    EventoEmpleado, CategoriaEvento, ConceptoNomina, ConceptoContrato, Feriado,
    HorasExtras, CuentaCorriente,
)
from app.models.usuario import Usuario
from app.schemas.schemas import NominaCreate, NominaUpdate, NominaOut, NominaDetalleCreate, NominaDetalleOut

log = logging.getLogger("nominas")
logging.basicConfig(level=logging.INFO)


class GenerarBorradorReq(BaseModel):
    empleado_id: int
    periodo_id: int


class CalcularMasivoReq(BaseModel):
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


async def _get_feriados_set(fecha_inicio: date, fecha_fin: date, db: AsyncSession) -> set:
    """Devuelve un set de fechas que son feriados dentro del rango dado."""
    r = await db.execute(
        select(Feriado.fecha).where(Feriado.fecha >= fecha_inicio, Feriado.fecha <= fecha_fin)
    )
    return {row[0] for row in r.fetchall()}


async def _get_or_create_concepto(
    db: AsyncSession,
    codigo_preferido: str,
    codigos_alt: list[str],
    nombre: str,
    tipo: str,
    categoria: str,
) -> int:
    """Busca un concepto por varios códigos posibles; si no existe, lo crea.

    Devuelve el id del concepto. Nunca retorna None: garantiza que exista.
    """
    codigos_todos = [codigo_preferido] + codigos_alt
    r = await db.execute(
        select(ConceptoNomina).where(ConceptoNomina.codigo.in_(codigos_todos))
    )
    existente = r.scalars().first()
    if existente:
        return existente.id
    # Crear con el código preferido
    nuevo = ConceptoNomina(
        codigo=codigo_preferido, nombre=nombre, tipo=tipo,
        categoria=categoria, activo=True,
    )
    db.add(nuevo)
    await db.flush()
    return nuevo.id


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

    # Obtener datos del empleado para saber si es en_blanco
    empleado = await db.get(Empleado, body.empleado_id)
    es_en_blanco = empleado.en_blanco if empleado else False

    # ── Obtener conceptos asignados al contrato ────────────────────────────
    r_cc = await db.execute(
        select(ConceptoContrato.concepto_id).where(ConceptoContrato.contrato_id == contrato.id)
    )
    conceptos_contrato_ids = set(r_cc.scalars().all())
    tiene_conceptos = len(conceptos_contrato_ids) > 0
    # Si tiene conceptos asignados, solo usar esos; sino usar todos (backward compatible)

    def _concepto_permitido(concepto_id: int | None) -> bool:
        """Devuelve True si el concepto está permitido para este contrato."""
        if not tiene_conceptos or concepto_id is None:
            return True  # sin restricción
        return concepto_id in conceptos_contrato_ids

    es_mensual = contrato.tipo_contrato == "mensual"
    salario_base = float(contrato.salario_mensual or 0) if es_mensual else 0
    hs_semanales = contrato.hs_semanales or 48

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

    # ── Concepto sueldo base (solo empleados mensuales) ──────────────────────
    if es_mensual:
        r_cs = await db.execute(select(ConceptoNomina).where(ConceptoNomina.codigo == "salario_base"))
        concepto_sueldo = r_cs.scalars().first()
        c_id = concepto_sueldo.id if concepto_sueldo else 1
        if _concepto_permitido(c_id):
            det_base = NominaDetalle(
                nomina_id=nomina.id, concepto_id=c_id, tipo="ingreso",
                cantidad=1, monto_unitario=salario_base, monto_total=salario_base,
                observacion="Sueldo base",
            )
            db.add(det_base)
            detalles.append(det_base)

    # ── Calcular valor de la hora ─────────────────────────────────────────────
    # Mensual: valor_hora = salario / (días_hábiles_período * 8 horas)
    # Por hora: usar tarifa directamente
    dias_periodo = (periodo.fecha_fin - periodo.fecha_inicio).days + 1
    dias_habiles = sum(
        1 for i in range(dias_periodo)
        if (periodo.fecha_inicio.toordinal() + i) % 7 not in (6, 0)  # excluye dom(6) y sáb(0) no, solo dom
    )
    dias_habiles = max(dias_habiles, 1)

    hs_por_dia = hs_semanales / 6  # 6 días laborales por semana
    if es_mensual:
        valor_hora = float(salario_base) / (dias_habiles * hs_por_dia) if salario_base else 0
    else:
        valor_hora = float(contrato.tarifa_hora or 0)

    # ── Feriados del período ──────────────────────────────────────────────────
    feriados_set = await _get_feriados_set(periodo.fecha_inicio, periodo.fecha_fin, db)

    # ── Buscar categoría de horas extras (cualquier variante) ───────────────
    r_cat_extra = await db.execute(
        select(CategoriaEvento).where(
            CategoriaEvento.codigo.in_([
                "horas_extras", "HE_EXTRA", "HORAS_EXTRAS", "hs_extras", "HE",
            ])
        )
    )
    cats_extra_ids = set(c.id for c in r_cat_extra.scalars().all())

    # ── Buscar categoría de falta injustificada ──────────────────────────────
    r_cat_falta = await db.execute(
        select(CategoriaEvento).where(
            CategoriaEvento.codigo.in_(["FALTA_INJ", "falta_inj", "FALTA", "ausencia"])
        )
    )
    cats_falta_ids = set(c.id for c in r_cat_falta.scalars().all())

    # ── Regla de negocio: llegadas tarde NO afectan el cálculo de nómina ─────
    # Se registran como eventos para trazabilidad pero no generan descuentos.
    r_cat_tarde = await db.execute(
        select(CategoriaEvento.id).where(
            CategoriaEvento.codigo.in_(["llegada_tarde", "TARDANZA", "tardanza", "LLEGADA_TARDE"])
        )
    )
    tarde_cat_ids = set(r_cat_tarde.scalars().all())

    # ── Eventos aprobados del período ─────────────────────────────────────────
    # Usar datetime al inicio/fin del día porque fecha_inicial es TIMESTAMPTZ
    fd = datetime.combine(periodo.fecha_inicio, time.min)
    fh = datetime.combine(periodo.fecha_fin, time.max)
    r_ev = await db.execute(
        select(EventoEmpleado).where(
            EventoEmpleado.empleado_id == body.empleado_id,
            EventoEmpleado.fecha_inicial >= fd,
            EventoEmpleado.fecha_inicial <= fh,
            EventoEmpleado.estado == "aprobado",
        )
    )
    eventos = r_ev.scalars().all()

    log.info("=" * 60)
    log.info(f"[NOMINA] Empleado #{body.empleado_id} ({empleado.apellido}, {empleado.nombre})")
    log.info(f"[NOMINA] Período: {periodo.fecha_inicio} → {periodo.fecha_fin}")
    log.info(f"[NOMINA] Rango query: {fd} → {fh}")
    log.info(f"[NOMINA] Eventos aprobados encontrados: {len(eventos)}")
    for _i, _ev in enumerate(eventos):
        log.info(
            f"  Evento #{_ev.id}: cat_id={_ev.categoria_evento_id}, "
            f"fecha={_ev.fecha_inicial}, estado={_ev.estado}, "
            f"horas_cantidad={_ev.horas_cantidad!r} (type={type(_ev.horas_cantidad).__name__}), "
            f"porcentaje_extra={_ev.porcentaje_extra!r}"
        )
    log.info(f"[NOMINA] tarde_cat_ids={tarde_cat_ids}")
    log.info(f"[NOMINA] cats_falta_ids={cats_falta_ids}")
    log.info(f"[NOMINA] cats_extra_ids={cats_extra_ids}")
    log.info(f"[NOMINA] valor_hora={valor_hora:.4f}")

    # Conceptos: usar get-or-create para garantizar que siempre existan
    desc_id = await _get_or_create_concepto(
        db, "ausencia_desc", ["DESC_FALTA", "descuento_falta"],
        "Descuento por falta", "deduccion", "ausencia",
    )
    ext50_id = await _get_or_create_concepto(
        db, "horas_extras_50", ["hora_extra_50", "HE_50", "hs_extras_50"],
        "Horas extras 50%", "ingreso", "horas_extras",
    )
    ext100_id = await _get_or_create_concepto(
        db, "horas_extras_100", ["hora_extra_100", "HE_100", "hs_extras_100"],
        "Horas extras 100%", "ingreso", "horas_extras",
    )
    log.info(f"[NOMINA] Conceptos: desc_id={desc_id}, ext50_id={ext50_id}, ext100_id={ext100_id}")

    valor_dia = float(salario_base) / 30 if (es_mensual and salario_base) else valor_hora * hs_por_dia

    for ev in eventos:
        # Skip llegadas tarde: no afectan el cálculo de nómina (regla de negocio)
        if ev.categoria_evento_id in tarde_cat_ids:
            log.info(f"  → Evento #{ev.id}: SKIP (llegada tarde)")
            continue

        fecha_ev = ev.fecha_inicial.date() if hasattr(ev.fecha_inicial, 'date') else ev.fecha_inicial

        # Horas extras: se detectan por tener horas_cantidad > 0
        # (independiente del código de la categoría, que puede variar entre instalaciones)
        tiene_horas = ev.horas_cantidad and float(ev.horas_cantidad) > 0
        log.info(
            f"  → Evento #{ev.id}: tiene_horas={tiene_horas}, "
            f"horas_cantidad={ev.horas_cantidad!r}, "
            f"cat_id={ev.categoria_evento_id}, "
            f"en_falta_ids={'SI' if ev.categoria_evento_id in cats_falta_ids else 'NO'}"
        )
        if tiene_horas:
            horas = float(ev.horas_cantidad)
            # Determinar porcentaje: si el evento ya lo tiene, usarlo; sino auto-detectar por feriado
            if ev.porcentaje_extra:
                pct = ev.porcentaje_extra
            else:
                pct = 100 if fecha_ev in feriados_set else 50

            # Los conceptos de horas extras son disparados por eventos aprobados,
            # por lo que NO se filtran por _concepto_permitido (se aplican siempre).
            if pct == 100:
                monto_unitario = valor_hora * 2.0
                total = monto_unitario * horas
                log.info(f"    ++ DETALLE HS100: {horas}h x ${monto_unitario:.2f} = ${total:.2f} (concepto_id={ext100_id})")
                det = NominaDetalle(
                    nomina_id=nomina.id, concepto_id=ext100_id, tipo="ingreso",
                    cantidad=horas, monto_unitario=monto_unitario,
                    monto_total=total,
                    evento_id=ev.id,
                    observacion=f"Hs extras al 100% ({horas}h) {'- feriado' if fecha_ev in feriados_set else '- guardia'}",
                )
                db.add(det)
                detalles.append(det)
            else:
                monto_unitario = valor_hora * 1.5
                total = monto_unitario * horas
                log.info(f"    ++ DETALLE HS50: {horas}h x ${monto_unitario:.2f} = ${total:.2f} (concepto_id={ext50_id})")
                det = NominaDetalle(
                    nomina_id=nomina.id, concepto_id=ext50_id, tipo="ingreso",
                    cantidad=horas, monto_unitario=monto_unitario,
                    monto_total=total,
                    evento_id=ev.id,
                    observacion=f"Hs extras al 50% ({horas}h)",
                )
                db.add(det)
                detalles.append(det)

        # Descuento solo por falta injustificada aprobada (también disparado por evento)
        elif (cats_falta_ids and ev.categoria_evento_id in cats_falta_ids
              and desc_id):
            log.info(f"    ++ DETALLE FALTA: 1 x ${valor_dia:.2f} (concepto_id={desc_id})")
            det_desc = NominaDetalle(
                nomina_id=nomina.id, concepto_id=desc_id, tipo="deduccion",
                cantidad=1, monto_unitario=valor_dia, monto_total=valor_dia,
                evento_id=ev.id, observacion="Descuento por falta injustificada",
            )
            db.add(det_desc)
            detalles.append(det_desc)
        else:
            log.info(f"    -- Evento #{ev.id}: NO MATCH (sin horas, no es falta)")

    log.info(f"[NOMINA] Total detalles de eventos: {len(detalles)}")

    # ── Horas extras de la tabla horas_extras (directas, sin aprobación) ─────
    r_he = await db.execute(
        select(HorasExtras).where(
            HorasExtras.empleado_id == body.empleado_id,
            HorasExtras.fecha >= periodo.fecha_inicio,
            HorasExtras.fecha <= periodo.fecha_fin,
        )
    )
    hs_extras_directas = r_he.scalars().all()
    log.info(f"[NOMINA] Horas extras directas en período: {len(hs_extras_directas)}")

    for he in hs_extras_directas:
        horas = float(he.horas_cantidad)
        pct = he.porcentaje
        if pct == 100:
            monto_unitario = valor_hora * 2.0
            total = monto_unitario * horas
            log.info(f"    ++ HE_DIRECTA 100%: {horas}h x ${monto_unitario:.2f} = ${total:.2f}")
            det = NominaDetalle(
                nomina_id=nomina.id, concepto_id=ext100_id, tipo="ingreso",
                cantidad=horas, monto_unitario=monto_unitario, monto_total=total,
                observacion=f"Hs extras 100% — {he.fecha}" + (f" ({he.observacion})" if he.observacion else ""),
            )
        else:
            monto_unitario = valor_hora * 1.5
            total = monto_unitario * horas
            log.info(f"    ++ HE_DIRECTA 50%: {horas}h x ${monto_unitario:.2f} = ${total:.2f}")
            det = NominaDetalle(
                nomina_id=nomina.id, concepto_id=ext50_id, tipo="ingreso",
                cantidad=horas, monto_unitario=monto_unitario, monto_total=total,
                observacion=f"Hs extras 50% — {he.fecha}" + (f" ({he.observacion})" if he.observacion else ""),
            )
        db.add(det)
        detalles.append(det)

    log.info(f"[NOMINA] Total detalles generados hasta ahora: {len(detalles)}")

    # ── Conceptos automáticos del contrato (% o monto fijo) ────────────────
    # Conceptos ya procesados arriba (por código)
    codigos_ya_procesados = {"salario_base", "ausencia_desc", "hora_extra_50", "hora_extra_100",
                              "horas_extras_50", "horas_extras_100",
                              "SAL_BASE", "DESC_FALTA", "HE_50", "HE_100"}
    if tiene_conceptos:
        r_conceptos = await db.execute(
            select(ConceptoNomina).where(
                ConceptoNomina.id.in_(conceptos_contrato_ids),
                ConceptoNomina.activo == True,
            )
        )
        for cn in r_conceptos.scalars().all():
            if cn.codigo in codigos_ya_procesados:
                continue
            # Empleados en negro (en_blanco=false): omitir aportes sociales/jubilatorios
            if not es_en_blanco and cn.categoria == "aporte_social":
                continue
            if cn.porcentaje and salario_base > 0:
                monto = salario_base * float(cn.porcentaje) / 100
                det = NominaDetalle(
                    nomina_id=nomina.id, concepto_id=cn.id, tipo=cn.tipo,
                    cantidad=1, monto_unitario=monto, monto_total=monto,
                    observacion=f"{cn.nombre} ({cn.porcentaje}%)",
                )
                db.add(det)
                detalles.append(det)
            elif cn.monto_fijo:
                monto = float(cn.monto_fijo)
                det = NominaDetalle(
                    nomina_id=nomina.id, concepto_id=cn.id, tipo=cn.tipo,
                    cantidad=1, monto_unitario=monto, monto_total=monto,
                    observacion=cn.nombre,
                )
                db.add(det)
                detalles.append(det)

    # ── Cuenta corriente pendiente del empleado ───────────────────────────────
    # Suma todos los cargos sin nomina_id (aún no descontados) y los deduce.
    r_cc = await db.execute(
        select(CuentaCorriente).where(
            CuentaCorriente.empleado_id == body.empleado_id,
            CuentaCorriente.nomina_id == None,
        )
    )
    cargos_cc = r_cc.scalars().all()
    total_cc = sum(float(c.monto) for c in cargos_cc)
    if total_cc > 0:
        cc_concepto_id = await _get_or_create_concepto(
            db, "cuenta_corriente_desc", ["cc_desc", "descuento_cc"],
            "Descuento cuenta corriente", "deduccion", "cuenta_corriente",
        )
        det_cc = NominaDetalle(
            nomina_id=nomina.id,
            concepto_id=cc_concepto_id,
            tipo="deduccion",
            cantidad=1,
            monto_unitario=total_cc,
            monto_total=total_cc,
            observacion=f"Cuenta corriente ({len(cargos_cc)} cargo(s))",
        )
        db.add(det_cc)
        detalles.append(det_cc)
        log.info(f"[NOMINA] Cuenta corriente: {len(cargos_cc)} cargos = ${total_cc:.2f}")
        # Marcar los cargos como vinculados a esta nómina (se setea nomina_id después del flush)
        for c in cargos_cc:
            c.nomina_id = nomina.id

    # Para empleados por hora: sumar horas trabajadas como ingreso base
    if not es_mensual and valor_hora > 0:
        r_cs2 = await db.execute(select(ConceptoNomina).where(ConceptoNomina.codigo == "salario_base"))
        concepto_sueldo2 = r_cs2.scalars().first()
        c_id = concepto_sueldo2.id if concepto_sueldo2 else 1
        # El monto base por hora se calcula al recalcular manualmente; aquí se pone 0 como placeholder
        det_base = NominaDetalle(
            nomina_id=nomina.id, concepto_id=c_id, tipo="ingreso",
            cantidad=0, monto_unitario=valor_hora, monto_total=0,
            observacion=f"Horas trabajadas (tarifa: ${valor_hora:.2f}/h) - completar cantidad",
        )
        db.add(det_base)
        detalles.append(det_base)

    await db.flush()
    ingresos, deducciones, neto = _calcular_totales(detalles)
    nomina.total_ingresos = ingresos
    nomina.total_deducciones = deducciones
    nomina.neto_a_pagar = neto

    await db.commit()
    await db.refresh(nomina)
    return nomina


async def _enrich_nomina(nomina: Nomina, db: AsyncSession) -> dict:
    """Agrega empleado_nombre al dict de la nómina."""
    data = {c.name: getattr(nomina, c.name) for c in nomina.__table__.columns}
    emp = await db.get(Empleado, nomina.empleado_id)
    data["empleado_nombre"] = f"{emp.apellido}, {emp.nombre}" if emp else None
    return data


@router.post("/calcular", status_code=201)
async def calcular_masivo(
    body: CalcularMasivoReq,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    """Genera borradores de nómina para TODOS los empleados activos con contrato vigente."""
    periodo = await db.get(PeriodoNomina, body.periodo_id)
    if not periodo:
        raise HTTPException(404, "Período no encontrado")
    if periodo.cerrado:
        raise HTTPException(400, "No se puede calcular en un período cerrado")

    # Obtener empleados activos con contrato activo
    r_contratos = await db.execute(
        select(Contrato).where(Contrato.activo == True)
    )
    contratos = r_contratos.scalars().all()
    if not contratos:
        raise HTTPException(400, "No hay empleados con contratos activos")

    # Borrar nóminas existentes del período para recalcular
    # Primero detalles, luego nóminas (respetar FK)
    nomina_ids_sub = select(Nomina.id).where(Nomina.periodo_id == body.periodo_id)
    await db.execute(delete(NominaDetalle).where(NominaDetalle.nomina_id.in_(nomina_ids_sub)))
    await db.execute(delete(Nomina).where(Nomina.periodo_id == body.periodo_id))
    await db.flush()

    resultados = []
    for contrato in contratos:
        # Verificar que el empleado esté activo
        empleado = await db.get(Empleado, contrato.empleado_id)
        if not empleado or not empleado.activo:
            continue

        # Generar borrador para cada empleado
        req = GenerarBorradorReq(empleado_id=contrato.empleado_id, periodo_id=body.periodo_id)
        nomina = await generar_borrador(req, db, current_user)
        resultados.append(await _enrich_nomina(nomina, db))

    return resultados


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
    nominas = result.scalars().all()
    return [await _enrich_nomina(n, db) for n in nominas]


@router.get("/{id}", response_model=NominaOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    return await _enrich_nomina(n, db)


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
    detalles = r.scalars().all()
    result = []
    for d in detalles:
        data = {c.name: getattr(d, c.name) for c in d.__table__.columns}
        concepto = await db.get(ConceptoNomina, d.concepto_id) if d.concepto_id else None
        data["concepto_nombre"] = concepto.nombre if concepto else None
        result.append(data)
    return result


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


class MarcarPagadoReq(BaseModel):
    monto_pagado: float | None = None


@router.post("/{id}/marcar-pagado", response_model=NominaOut)
async def marcar_pagado(
    id: int,
    body: MarcarPagadoReq = MarcarPagadoReq(),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    n.pagado = True
    n.fecha_pago = datetime.utcnow()
    n.pagado_por_id = current_user.id
    n.monto_pagado = body.monto_pagado if body.monto_pagado is not None else n.neto_a_pagar
    await db.commit()
    await db.refresh(n)
    return await _enrich_nomina(n, db)


@router.post("/{id}/desmarcar-pagado", response_model=NominaOut)
async def desmarcar_pagado(
    id: int,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin", "liquidador")),
):
    n = await db.get(Nomina, id)
    if not n:
        raise HTTPException(404, "Nómina no encontrada")
    n.pagado = False
    n.fecha_pago = None
    n.pagado_por_id = None
    n.monto_pagado = None
    await db.commit()
    await db.refresh(n)
    return await _enrich_nomina(n, db)
