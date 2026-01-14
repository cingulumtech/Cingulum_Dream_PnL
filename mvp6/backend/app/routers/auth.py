import os
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

router = APIRouter(prefix="/api/auth", tags=["auth"])
ALLOWED_SIGNUP_CODES = [c.strip() for c in os.environ.get("ALLOWED_SIGNUP_CODES", "").split(",") if c.strip()]


@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if not ALLOWED_SIGNUP_CODES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Signups are disabled")
    if not payload.invite_code or payload.invite_code not in ALLOWED_SIGNUP_CODES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite code")
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = models.User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_session(db, user, payload.remember)
    set_auth_cookies(response, token)
    return schemas.AuthResponse(user=user)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_session(db, user, payload.remember)
    set_auth_cookies(response, token)
    return schemas.AuthResponse(user=user)


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
    return schemas.AuthResponse(user=user)
