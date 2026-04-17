"""
Configuración de pytest: usa SQLite async en memoria para que las pruebas
no requieran PostgreSQL ni Docker.
Se monkeypatean:
  - get_db       → sesión sobre SQLite
  - get_current_user / require_roles → usuario fake (superadmin)
"""
import asyncio
import pytest
import pytest_asyncio  # noqa: F401 – necesario para fixture async
from httpx import AsyncClient, ASGITransport

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# ---------- Preparar engine SQLite antes de importar la app ----------
from app.core import database as db_module
from app.models.models import *  # noqa: F401,F403 – importa todos los modelos
from app.models.usuario import Usuario

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine_test = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = async_sessionmaker(engine_test, expire_on_commit=False, class_=AsyncSession)


# ---------- Override de dependencias ------------------------------------

async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
        finally:
            await session.close()


def _fake_user():
    """Retorna un Usuario fake con rol superadmin para los tests."""
    u = Usuario.__new__(Usuario)
    u.id = 1
    u.email = "test@test.com"
    u.rol = "superadmin"
    u.activo = True
    u.empleado_id = None
    u.password_hash = ""
    u.ultimo_login = None
    return u


async def override_get_current_user():
    return _fake_user()


def override_require_roles(*roles):
    async def inner():
        return _fake_user()
    return inner


# ---------- Fixtures ---------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    """Crea todas las tablas en la DB de memoria antes de los tests."""
    async with engine_test.begin() as conn:
        await conn.run_sync(db_module.Base.metadata.create_all)
    yield
    async with engine_test.begin() as conn:
        await conn.run_sync(db_module.Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="session")
async def client(setup_db):
    """Cliente HTTP async sobre la app FastAPI montada en memoria."""
    from app.core.deps import get_current_user, require_roles
    from app.core.database import get_db
    from main import app

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    # require_roles es una función que retorna otra función; patcheamos en cada router
    # En su lugar, patcheamos directamente el módulo deps
    import app.core.deps as deps_mod
    deps_mod.require_roles = override_require_roles

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
