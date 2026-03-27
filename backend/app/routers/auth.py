from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import create_access_token, hash_password, verify_password
from app.models.usuario import Usuario
from app.schemas.schemas import Token, UsuarioCreate, UsuarioUpdate, UsuarioOut, CambiarPasswordRequest

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Usuario).where(Usuario.email == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos")
    if not user.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

    user.ultimo_login = datetime.utcnow()
    await db.commit()
    token = create_access_token({"sub": str(user.id), "rol": user.rol})
    return Token(access_token=token)


@router.get("/me", response_model=UsuarioOut)
async def me(current_user: Usuario = Depends(get_current_user)):
    return current_user


@router.get("/usuarios", response_model=list[UsuarioOut])
async def listar_usuarios(
    activo: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin")),
):
    q = select(Usuario)
    if activo is not None:
        q = q.where(Usuario.activo == activo)
    q = q.order_by(Usuario.email).offset(skip).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
async def crear_usuario(
    body: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin")),
):
    r = await db.execute(select(Usuario).where(Usuario.email == body.email))
    if r.scalar_one_or_none():
        raise HTTPException(400, "El email ya está registrado")
    user = Usuario(
        email=body.email,
        password_hash=hash_password(body.password),
        rol=body.rol,
        activo=body.activo,
        empleado_id=body.empleado_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/usuarios/{id}", response_model=UsuarioOut)
async def actualizar_usuario(
    id: int,
    body: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_roles("superadmin", "admin")),
):
    user = await db.get(Usuario, id)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/usuarios/{id}", status_code=204)
async def desactivar_usuario(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles("superadmin", "admin")),
):
    if current_user.id == id:
        raise HTTPException(400, "No puedes desactivar tu propio usuario")
    user = await db.get(Usuario, id)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.activo = False
    await db.commit()


@router.post("/cambiar-password", status_code=204)
async def cambiar_password(
    body: CambiarPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if not verify_password(body.password_actual, current_user.password_hash):
        raise HTTPException(400, "Contraseña actual incorrecta")
    current_user.password_hash = hash_password(body.password_nuevo)
    await db.commit()
