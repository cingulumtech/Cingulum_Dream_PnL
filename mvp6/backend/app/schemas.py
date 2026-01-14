from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: str
    email: EmailStr

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    user: UserOut


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False
    invite_code: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class ImportCreate(BaseModel):
    name: str
    kind: str
    status: str
    metadata: Dict[str, Any]


class ImportOut(BaseModel):
    id: str
    name: str
    kind: str
    status: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConfigPayload(BaseModel):
    name: str
    data: Dict[str, Any]


class ConfigOut(BaseModel):
    id: str
    name: str
    data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SnapshotPayload(BaseModel):
    schema_version: str
    data: Dict[str, Any]


class SnapshotCreate(BaseModel):
    name: str
    payload: SnapshotPayload


class SnapshotUpdate(BaseModel):
    name: Optional[str] = None
    payload: Optional[SnapshotPayload] = None


class SnapshotOut(BaseModel):
    id: str
    name: str
    owner_user_id: str
    owner_email: EmailStr
    role: str
    payload: Optional[SnapshotPayload] = None
    summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SnapshotShareCreate(BaseModel):
    email: EmailStr
    role: str


class SnapshotShareUpdate(BaseModel):
    role: str


class SnapshotShareOut(BaseModel):
    id: str
    snapshot_id: str
    user_id: str
    user_email: EmailStr
    role: str

    class Config:
        from_attributes = True


class StateResponse(BaseModel):
    template: Optional[ConfigOut] = None
    mapping: Optional[ConfigOut] = None
    report: Optional[ConfigOut] = None
    settings: Optional[ConfigOut] = None
    imports: List[ImportOut] = []
    snapshots: List[SnapshotOut] = []
