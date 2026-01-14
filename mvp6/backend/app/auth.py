import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request, Response, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from .db import get_db
from . import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "atlas_session")
CSRF_COOKIE_NAME = os.environ.get("CSRF_COOKIE_NAME", "atlas_csrf")
SESSION_TTL_HOURS = int(os.environ.get("SESSION_TTL_HOURS", "12"))
REMEMBER_TTL_DAYS = int(os.environ.get("REMEMBER_TTL_DAYS", "14"))
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: models.User, remember: bool) -> str:
    token = secrets.token_urlsafe(32)
    ttl = timedelta(days=REMEMBER_TTL_DAYS) if remember else timedelta(hours=SESSION_TTL_HOURS)
    expires_at = datetime.utcnow() + ttl
    session = models.Session(user_id=user.id, token_hash=hash_token(token), expires_at=expires_at)
    db.add(session)
    db.commit()
    return token


def clear_session(db: Session, token: str) -> None:
    token_hash = hash_token(token)
    db.query(models.Session).filter(models.Session.token_hash == token_hash).delete()
    db.commit()


def set_auth_cookies(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    csrf_token = secrets.token_urlsafe(16)
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")


def get_session_token(request: Request) -> Optional[str]:
    return request.cookies.get(SESSION_COOKIE_NAME)


def require_csrf(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    csrf_header = request.headers.get("X-CSRF-Token")
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> models.User:
    token = get_session_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token_hash = hash_token(token)
    now = datetime.utcnow()
    session = (
        db.query(models.Session)
        .filter(models.Session.token_hash == token_hash)
        .filter(models.Session.expires_at > now)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user = db.query(models.User).filter(models.User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return user
