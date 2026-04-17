"""
Script para crear los 2 usuarios con rol 'operador' (solo acceso a Eventos).
Ejecutar una sola vez desde la carpeta backend:
    cd backend
    python scripts/crear_operadores.py
"""
import asyncio
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.usuario import Usuario
from sqlalchemy import select

USUARIOS = [
    {"email": "operador1@nomina.local", "password": "Operador1234!", "nombre": "Operador 1"},
    {"email": "operador2@nomina.local", "password": "Operador1234!", "nombre": "Operador 2"},
]


async def main():
    async with AsyncSessionLocal() as db:
        for u in USUARIOS:
            r = await db.execute(select(Usuario).where(Usuario.email == u["email"]))
            if r.scalar_one_or_none():
                print(f"  Ya existe: {u['email']}")
                continue

            user = Usuario(
                email=u["email"],
                password_hash=hash_password(u["password"]),
                rol="operador",
                activo=True,
            )
            db.add(user)
            await db.commit()
            print(f"✓ Creado: {u['email']}  |  password: {u['password']}  |  rol: operador")

    print("\nEstos usuarios solo pueden ver la sección Eventos.")
    print("Podés cambiar las contraseñas desde la sección Configuración.")


asyncio.run(main())
