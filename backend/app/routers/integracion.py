"""
Endpoints para integraciones externas (n8n, otros sistemas).
Autenticación por API key estática en header X-API-Key.
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Empleado, CuentaCorriente

router = APIRouter(prefix="/integracion", tags=["Integración externa"])


def _check_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Valida la API key. Lanza 403 si no es válida o no está configurada."""
    if not settings.INTEGRATION_API_KEY:
        raise HTTPException(503, "Integración no configurada en el servidor")
    if x_api_key != settings.INTEGRATION_API_KEY:
        raise HTTPException(403, "API key inválida")


# ── Schemas de entrada (flexibles para adaptarse al sistema externo) ──────────

class EmpleadoIntegracionIn(BaseModel):
    """
    Campos que puede enviar el sistema externo.
    Solo nombre, apellido y nro_vendedor son obligatorios.
    """
    nro_vendedor: int
    nombre: str
    apellido: str
    documento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    fecha_ingreso: Optional[str] = None   # YYYY-MM-DD, default hoy


class CuentaCorrienteIntegracionIn(BaseModel):
    """
    Cargo de cuenta corriente enviado por el sistema externo.
    Se identifica al empleado por nro_vendedor.
    """
    nro_vendedor: int
    monto: Decimal
    descripcion: Optional[str] = None
    fecha: Optional[str] = None   # YYYY-MM-DD, default hoy


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/empleado", status_code=201)
async def crear_empleado_externo(
    body: EmpleadoIntegracionIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(_check_api_key),
):
    """
    Crea un empleado desde el sistema externo.
    Si ya existe un empleado con ese nro_vendedor, devuelve el existente (idempotente).
    """
    # Idempotente: si ya existe con ese nro_vendedor, lo devuelve
    r = await db.execute(
        select(Empleado).where(Empleado.nro_vendedor == body.nro_vendedor)
    )
    existente = r.scalars().first()
    if existente:
        return {
            "accion": "existente",
            "empleado_id": existente.id,
            "nro_vendedor": existente.nro_vendedor,
            "nombre": f"{existente.apellido}, {existente.nombre}",
            "activo": existente.activo,
        }

    fecha_ingreso = body.fecha_ingreso or str(date.today())

    # Normalizar vacíos a None
    email = body.email if body.email else None
    documento = body.documento if body.documento else None
    telefono = body.telefono if body.telefono else None

    try:
        emp = Empleado(
            nro_vendedor=body.nro_vendedor,
            nombre=body.nombre,
            apellido=body.apellido,
            documento=documento,
            email=email,
            telefono=telefono,
            fecha_ingreso=fecha_ingreso,
            activo=True,
            en_blanco=False,
        )
        db.add(emp)
        await db.commit()
        await db.refresh(emp)
        return {
            "accion": "creado",
            "empleado_id": emp.id,
            "nro_vendedor": emp.nro_vendedor,
            "nombre": f"{emp.apellido}, {emp.nombre}",
            "activo": emp.activo,
        }
    except IntegrityError as e:
        await db.rollback()
        err_str = str(e.orig).lower()
        if "documento" in err_str:
            raise HTTPException(409, f"Ya existe un empleado con el documento {body.documento}")
        if "email" in err_str:
            raise HTTPException(409, f"Ya existe un empleado con el email {body.email}")
        raise HTTPException(409, "Conflicto al crear el empleado (dato duplicado)")


@router.post("/cuenta-corriente", status_code=201)
async def crear_cargo_externo(
    body: CuentaCorrienteIntegracionIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(_check_api_key),
):
    """
    Registra un cargo en la cuenta corriente de un empleado, identificado por nro_vendedor.
    """
    # Buscar empleado por nro_vendedor
    r = await db.execute(
        select(Empleado).where(Empleado.nro_vendedor == body.nro_vendedor)
    )
    emp = r.scalars().first()
    if not emp:
        raise HTTPException(404, f"No se encontró empleado con nro_vendedor={body.nro_vendedor}")
    if not emp.activo:
        raise HTTPException(400, f"El empleado {emp.apellido}, {emp.nombre} está inactivo")
    if float(body.monto) <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")

    fecha = body.fecha or str(date.today())

    cc = CuentaCorriente(
        empleado_id=emp.id,
        fecha=fecha,
        monto=body.monto,
        descripcion=body.descripcion,
    )
    db.add(cc)
    await db.commit()
    await db.refresh(cc)

    return {
        "accion": "creado",
        "cargo_id": cc.id,
        "empleado_id": emp.id,
        "nro_vendedor": emp.nro_vendedor,
        "empleado_nombre": f"{emp.apellido}, {emp.nombre}",
        "monto": float(cc.monto),
        "fecha": str(cc.fecha),
        "descripcion": cc.descripcion,
    }
