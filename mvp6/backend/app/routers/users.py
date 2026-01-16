from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, hash_password, require_csrf
from ..user_roles import USER_ROLES, normalize_user_role

router = APIRouter(prefix="/api/users", tags=["users"])


def require_super_admin(user: models.User):
    if normalize_user_role(getattr(user, "role", "view")) != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")


def require_admin(user: models.User):
    role = normalize_user_role(getattr(user, "role", "view"))
    if role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def to_user_admin_out(user: models.User) -> schemas.UserAdminOut:
    data = schemas.UserAdminOut.model_validate(user)
    return data.model_copy(update={"role": normalize_user_role(data.role)})


@router.get("", response_model=list[schemas.UserAdminOut])
def list_users(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    require_admin(user)
    users = db.query(models.User).order_by(models.User.created_at.asc()).all()
    return [to_user_admin_out(u) for u in users]


@router.post("", response_model=schemas.UserAdminOut)
def create_user(
    payload: schemas.UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    require_admin(user)
    normalized_role = normalize_user_role(payload.role or "view")
    if normalized_role not in USER_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    if normalize_user_role(getattr(user, "role", "view")) != "super_admin" and normalized_role in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient privileges to assign role")
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    new_user = models.User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=normalized_role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return to_user_admin_out(new_user)


@router.patch("/{user_id}", response_model=schemas.UserAdminOut)
def update_user(
    user_id: str,
    payload: schemas.UserRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    require_super_admin(user)
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    normalized_role = normalize_user_role(payload.role)
    if normalized_role not in USER_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    if target.id == user.id and normalized_role != "super_admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove your own super admin role")
    target.role = normalized_role
    db.commit()
    db.refresh(target)
    return to_user_admin_out(target)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    require_super_admin(user)
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    db.delete(target)
    db.commit()
    return {"ok": True}
