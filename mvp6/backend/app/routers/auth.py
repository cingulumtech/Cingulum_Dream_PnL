from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import (
    clear_auth_cookies,
    clear_session,
    create_session,
    get_current_user,
    hash_password,
    SESSION_COOKIE_NAME,
    require_csrf,
    set_auth_cookies,
    verify_password,
)
from ..user_roles import normalize_user_role

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterRequest, response: Response, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    is_first_user = db.query(models.User).count() == 0
    role = "super_admin" if is_first_user else "view"
    user = models.User(email=payload.email.lower(), password_hash=hash_password(payload.password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_session(db, user, payload.remember)
    set_auth_cookies(response, token)
    return schemas.AuthResponse(user=schemas.UserOut.model_validate(user).model_copy(update={"role": normalize_user_role(user.role)}))


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_session(db, user, payload.remember)
    set_auth_cookies(response, token)
    return schemas.AuthResponse(user=schemas.UserOut.model_validate(user).model_copy(update={"role": normalize_user_role(user.role)}))


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    require_csrf(request)
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        clear_session(db, token)
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=schemas.AuthResponse)
def me(user: models.User = Depends(get_current_user)):
    return schemas.AuthResponse(user=schemas.UserOut.model_validate(user).model_copy(update={"role": normalize_user_role(user.role)}))


@router.patch("/account", response_model=schemas.AuthResponse)
def update_account(
    payload: schemas.AccountUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    updated = False

    if payload.email:
        email = payload.email.strip().lower()
        if email and email != user.email:
            existing = db.query(models.User).filter(models.User.email == email).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
            user.email = email
            updated = True

    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password required")
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        user.password_hash = hash_password(payload.new_password)
        updated = True

    if updated:
        db.add(user)
        db.commit()
        db.refresh(user)

    return schemas.AuthResponse(user=schemas.UserOut.model_validate(user).model_copy(update={"role": normalize_user_role(user.role)}))
