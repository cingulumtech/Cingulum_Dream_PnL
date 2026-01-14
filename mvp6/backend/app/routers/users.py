from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, require_csrf

router = APIRouter(prefix="/api/users", tags=["users"])


def require_super_admin(user: models.User):
    if getattr(user, "role", "viewer") != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("", response_model=list[schemas.UserAdminOut])
def list_users(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    require_super_admin(user)
    users = db.query(models.User).order_by(models.User.created_at.asc()).all()
    return [schemas.UserAdminOut.model_validate(u) for u in users]


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
    if target.id == user.id and payload.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove your own admin role")
    target.role = payload.role
    db.commit()
    db.refresh(target)
    return schemas.UserAdminOut.model_validate(target)
