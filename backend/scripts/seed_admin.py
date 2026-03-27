"""
Seed script — crea el primer usuario superadmin.

Uso dentro del contenedor:
    python scripts/seed_admin.py

Se puede personalizar con variables de entorno:
    SEED_EMAIL    (default: admin@nomina.local)
    SEED_PASSWORD (default: Admin123!)
"""

import asyncio
import os
import sys

# Asegurar que el directorio raíz del backend esté en el path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.core.database import engine, AsyncSessionLocal, Base
from app.core.security import hash_password
from app.models.usuario import Usuario
# Importar todos los modelos para que Base.metadata los conozca
import app.models.models  # noqa: F401


SEED_EMAIL = os.getenv("SEED_EMAIL", "admin@nomina.local")
SEED_PASSWORD = os.getenv("SEED_PASSWORD", "Admin123!")


async def main() -> None:
    # Crear tablas si no existen
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Usuario).where(Usuario.email == SEED_EMAIL)
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"⚠️  El usuario '{SEED_EMAIL}' ya existe (id={existing.id}). No se creó nada.")
            return

        user = Usuario(
            email=SEED_EMAIL,
            password_hash=hash_password(SEED_PASSWORD),
            rol="superadmin",
            activo=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"✅ Usuario superadmin creado:")
        print(f"   Email:    {SEED_EMAIL}")
        print(f"   Password: {SEED_PASSWORD}")
        print(f"   Rol:      superadmin")
        print(f"   ID:       {user.id}")


if __name__ == "__main__":
    asyncio.run(main())
