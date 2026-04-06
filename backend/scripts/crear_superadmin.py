"""
Script para crear el primer usuario superadmin.
Ejecutar una sola vez:
    cd backend
    python scripts/crear_superadmin.py
"""
import asyncio
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.usuario import Usuario
from sqlalchemy import select


async def main():
    email = "admin@nomina.com"
    password = "Admin1234!"

    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Usuario).where(Usuario.email == email))
        if r.scalar_one_or_none():
            print(f"Usuario {email} ya existe.")
            return

        user = Usuario(
            email=email,
            password_hash=hash_password(password),
            rol="superadmin",
            activo=True,
        )
        db.add(user)
        await db.commit()
        print(f"✓ Superadmin creado")
        print(f"  Email:    {email}")
        print(f"  Password: {password}")
        print(f"  Rol:      superadmin")
        print()
        print("Cambiá la contraseña después del primer login.")


asyncio.run(main())
