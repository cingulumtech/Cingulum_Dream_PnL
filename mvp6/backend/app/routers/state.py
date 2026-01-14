from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, require_csrf
from ..rbac import SnapshotRole, resolve_role
from .snapshots import snapshot_to_out

router = APIRouter(prefix="/api/state", tags=["state"])


def upsert_single(db: Session, model, owner_id: str, name: str, data: dict):
    record = db.query(model).filter(model.owner_user_id == owner_id).first()
    if record:
        record.name = name
        record.data = data
    else:
        record = model(owner_user_id=owner_id, name=name, data=data)
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=schemas.StateResponse)
def get_state(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    template = db.query(models.LayoutTemplate).filter(models.LayoutTemplate.owner_user_id == user.id).first()
    mapping = db.query(models.MappingConfig).filter(models.MappingConfig.owner_user_id == user.id).first()
    report = db.query(models.ReportConfig).filter(models.ReportConfig.owner_user_id == user.id).first()
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    imports = (
        db.query(models.ImportRecord)
        .filter(models.ImportRecord.owner_user_id == user.id)
        .order_by(models.ImportRecord.created_at.desc())
        .all()
    )
    owned = db.query(models.Snapshot).filter(models.Snapshot.owner_user_id == user.id).all()
    shared = (
        db.query(models.Snapshot)
        .join(models.SnapshotShare, models.SnapshotShare.snapshot_id == models.Snapshot.id)
        .filter(models.SnapshotShare.user_id == user.id)
        .all()
    )
    snapshots = []
    for snap in owned:
        snapshots.append(snapshot_to_out(db, snap, SnapshotRole.owner, include_payload=False))
    for snap in shared:
        role = resolve_role(db, snap, user)
        if role:
            snapshots.append(snapshot_to_out(db, snap, role, include_payload=False))
    return schemas.StateResponse(
        template=schemas.ConfigOut.model_validate(template) if template else None,
        mapping=schemas.ConfigOut.model_validate(mapping) if mapping else None,
        report=schemas.ConfigOut.model_validate(report) if report else None,
        settings=schemas.ConfigOut.model_validate(settings) if settings else None,
        imports=[
            schemas.ImportOut(
                id=i.id,
                name=i.name,
                kind=i.kind,
                status=i.status,
                metadata=i.meta,
                created_at=i.created_at,
                updated_at=i.updated_at,
            )
            for i in imports
        ],
        snapshots=snapshots,
    )


@router.put("/template", response_model=schemas.ConfigOut)
def save_template(
    payload: schemas.ConfigPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = upsert_single(db, models.LayoutTemplate, user.id, payload.name, payload.data)
    upsert_single(db, models.MappingConfig, user.id, payload.name, payload.data)
    return schemas.ConfigOut.model_validate(record)


@router.put("/report", response_model=schemas.ConfigOut)
def save_report(
    payload: schemas.ConfigPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = upsert_single(db, models.ReportConfig, user.id, payload.name, payload.data)
    return schemas.ConfigOut.model_validate(record)


@router.put("/settings", response_model=schemas.ConfigOut)
def save_settings(
    payload: schemas.ConfigPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if record:
        record.data = payload.data
        record.name = payload.name
    else:
        record = models.UserSettings(user_id=user.id, data=payload.data, name=payload.name)
        db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.ConfigOut.model_validate(record)


@router.post("/imports", response_model=schemas.ImportOut)
def create_import(
    payload: schemas.ImportCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = models.ImportRecord(
        owner_user_id=user.id,
        name=payload.name,
        kind=payload.kind,
        status=payload.status,
        meta=payload.metadata,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.ImportOut(
        id=record.id,
        name=record.name,
        kind=record.kind,
        status=record.status,
        metadata=record.meta,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )
