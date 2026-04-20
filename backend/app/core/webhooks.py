"""
Utilidades para enviar notificaciones a webhooks externos (n8n, etc.).
El envío es fire-and-forget: nunca bloquea ni falla el endpoint principal.
"""
import asyncio
import json
import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _json_safe(obj: Any) -> Any:
    """Convierte recursivamente tipos no serializables por el encoder estándar."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(i) for i in obj]
    return obj


async def _post_webhook(url: str, payload: dict[str, Any]) -> None:
    """Envía el payload al webhook. Si falla, solo loguea el error."""
    try:
        safe_payload = _json_safe(payload)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                content=json.dumps(safe_payload),
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            logger.info(f"[webhook] OK → {url} | status={resp.status_code}")
    except Exception as exc:
        logger.warning(f"[webhook] FALLO → {url} | error={exc}")


def fire_evento_webhook(payload: dict[str, Any]) -> None:
    """
    Dispara el webhook de eventos de forma asíncrona (fire-and-forget).
    Si WEBHOOK_N8N_EVENTOS_URL no está configurado, no hace nada.
    """
    url = settings.WEBHOOK_N8N_EVENTOS_URL
    if not url:
        return
    # Agregar timestamp de envío
    payload["webhook_timestamp"] = datetime.utcnow().isoformat() + "Z"
    # Programar la tarea sin bloquear
    asyncio.create_task(_post_webhook(url, payload))


def build_evento_payload(
    accion: str,
    evento_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Construye el payload estándar que se envía al webhook de n8n.

    accion: "creado" | "aprobado" | "rechazado" | "actualizado"
    evento_data: dict con todos los campos del evento enriquecido
    """
    return {
        "accion": accion,
        "evento_id": evento_data.get("id"),
        "empleado_nombre": evento_data.get("empleado_nombre"),
        "categoria_nombre": evento_data.get("categoria_nombre"),
        "sucursal_nombre": evento_data.get("sucursal_nombre"),
        "estado": evento_data.get("estado"),
        "fecha_inicial": str(evento_data["fecha_inicial"]) if evento_data.get("fecha_inicial") else None,
        "fecha_final": str(evento_data["fecha_final"]) if evento_data.get("fecha_final") else None,
        "horas_cantidad": evento_data.get("horas_cantidad"),
        "observacion": evento_data.get("observacion"),
        "motivo_actualizacion": evento_data.get("motivo_actualizacion"),
        "justificado": evento_data.get("justificado"),
        "created_by_nombre": evento_data.get("created_by_nombre"),
        "created_at": str(evento_data["created_at"]) if evento_data.get("created_at") else None,
    }
