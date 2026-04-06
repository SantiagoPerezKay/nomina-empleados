"""
Script standalone para crear superadmin.
No depende del módulo app.core.config ni de .env.
Uso:
    python scripts/create_admin_standalone.py <DATABASE_URL> [email] [password]

Ejemplo:
    python scripts/create_admin_standalone.py \
        "postgresql://postgres:pass@host:5432/nomina_db" \
        admin@nomina.local \
        Admin123!
"""

import asyncio
import sys
import os

# Necesitamos bcrypt para hashear la contraseña
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_password(pwd: str) -> str:
        return pwd_context.hash(pwd)
except ImportError:
    import hashlib, hmac
    def hash_password(pwd: str) -> str:
        raise RuntimeError("passlib no instalado. Instala con: pip install passlib[bcrypt]")

try:
    import asyncpg
except ImportError:
    print("ERROR: asyncpg no instalado. Instala con: pip install asyncpg")
    sys.exit(1)


async def main():
    if len(sys.argv) < 2:
        print("Uso: python create_admin_standalone.py <DATABASE_URL> [email] [password]")
        print("Ejemplo: python create_admin_standalone.py postgresql://postgres:pass@host:5432/nomina_db")
        sys.exit(1)

    db_url = sys.argv[1]
    email = sys.argv[2] if len(sys.argv) > 2 else "admin@nomina.local"
    password = sys.argv[3] if len(sys.argv) > 3 else "Admin123!"

    # asyncpg usa postgresql://, no postgresql+asyncpg://
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Conectando a: {db_url[:40]}...")

    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        print(f"ERROR al conectar: {e}")
        sys.exit(1)

    try:
        # Ver si ya existe
        existing = await conn.fetchrow(
            "SELECT id, email FROM usuarios WHERE email = $1", email
        )
        if existing:
            print(f"⚠️  El usuario '{email}' ya existe (id={existing['id']}). No se creó nada.")
            return

        hashed = hash_password(password)
        row = await conn.fetchrow(
            """
            INSERT INTO usuarios (email, password_hash, rol, activo)
            VALUES ($1, $2, 'superadmin', true)
            RETURNING id
            """,
            email, hashed
        )
        print(f"✅ Usuario superadmin creado:")
        print(f"   Email:    {email}")
        print(f"   Password: {password}")
        print(f"   Rol:      superadmin")
        print(f"   ID:       {row['id']}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
