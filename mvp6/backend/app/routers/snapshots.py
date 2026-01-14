from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, require_csrf
from ..rbac import SnapshotRole, require_role, resolve_role

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


def snapshot_to_out(db: Session, snapshot: models.Snapshot, role: SnapshotRole, include_payload: bool) -> schemas.SnapshotOut:
    owner = db.query(models.User).filter(models.User.id == snapshot.owner_user_id).first()
    payload = None
    if include_payload:
        payload = schemas.SnapshotPayload(schema_version=snapshot.schema_version, data=snapshot.payload)
    summary = None
    if isinstance(snapshot.payload, dict):
        summary = snapshot.payload.get("summary")
    return schemas.SnapshotOut(
        id=snapshot.id,
        name=snapshot.name,
        owner_user_id=snapshot.owner_user_id,
        owner_email=owner.email if owner else "unknown@example.com",
        role=role.value,
        payload=payload,
        summary=summary,
        created_at=snapshot.created_at,
        updated_at=snapshot.updated_at,
    )


@router.get("", response_model=list[schemas.SnapshotOut])
def list_snapshots(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
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
    return sorted(snapshots, key=lambda s: s.updated_at, reverse=True)


@router.post("", response_model=schemas.SnapshotOut)
def create_snapshot(
    payload: schemas.SnapshotCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = models.Snapshot(
        owner_user_id=user.id,
        name=payload.name,
        payload=payload.payload.data,
        schema_version=payload.payload.schema_version,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snapshot_to_out(db, snap, SnapshotRole.owner, include_payload=True)


@router.get("/{snapshot_id}", response_model=schemas.SnapshotOut)
def get_snapshot(snapshot_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.viewer)
    return snapshot_to_out(db, snap, role, include_payload=True)


@router.patch("/{snapshot_id}", response_model=schemas.SnapshotOut)
def update_snapshot(
    snapshot_id: str,
    payload: schemas.SnapshotUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.editor)
    if payload.name:
        snap.name = payload.name
    if payload.payload:
        snap.payload = payload.payload.data
        snap.schema_version = payload.payload.schema_version
    db.commit()
    db.refresh(snap)
    return snapshot_to_out(db, snap, role, include_payload=False)


@router.post("/{snapshot_id}/duplicate", response_model=schemas.SnapshotOut)
def duplicate_snapshot(
    snapshot_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.viewer)
    copy = models.Snapshot(
        owner_user_id=user.id,
        name=f"{snap.name} (Copy)",
        payload=snap.payload,
        schema_version=snap.schema_version,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return snapshot_to_out(db, copy, SnapshotRole.owner, include_payload=False)


@router.delete("/{snapshot_id}")
def delete_snapshot(
    snapshot_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    if snap.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can delete")
    db.delete(snap)
    db.commit()
    return {"ok": True}


@router.get("/{snapshot_id}/shares", response_model=list[schemas.SnapshotShareOut])
def list_shares(snapshot_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.viewer)
    shares = (
        db.query(models.SnapshotShare)
        .filter(models.SnapshotShare.snapshot_id == snapshot_id)
        .all()
    )
    results = []
    for share in shares:
        share_user = db.query(models.User).filter(models.User.id == share.user_id).first()
        results.append(
            schemas.SnapshotShareOut(
                id=share.id,
                snapshot_id=snapshot_id,
                user_id=share.user_id,
                user_email=share_user.email if share_user else "unknown@example.com",
                role=share.role,
            )
        )
    return results


@router.post("/{snapshot_id}/shares", response_model=schemas.SnapshotShareOut)
def create_share(
    snapshot_id: str,
    payload: schemas.SnapshotShareCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.admin)
    target = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == snap.owner_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner already has access")
    share = (
        db.query(models.SnapshotShare)
        .filter(models.SnapshotShare.snapshot_id == snapshot_id)
        .filter(models.SnapshotShare.user_id == target.id)
        .first()
    )
    if share:
        share.role = payload.role
    else:
        share = models.SnapshotShare(snapshot_id=snapshot_id, user_id=target.id, role=payload.role)
        db.add(share)
    db.commit()
    db.refresh(share)
    return schemas.SnapshotShareOut(
        id=share.id,
        snapshot_id=snapshot_id,
        user_id=share.user_id,
        user_email=target.email,
        role=share.role,
    )


@router.patch("/{snapshot_id}/shares/{share_id}", response_model=schemas.SnapshotShareOut)
def update_share(
    snapshot_id: str,
    share_id: str,
    payload: schemas.SnapshotShareUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.admin)
    share = db.query(models.SnapshotShare).filter(models.SnapshotShare.id == share_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    share.role = payload.role
    db.commit()
    db.refresh(share)
    share_user = db.query(models.User).filter(models.User.id == share.user_id).first()
    return schemas.SnapshotShareOut(
        id=share.id,
        snapshot_id=share.snapshot_id,
        user_id=share.user_id,
        user_email=share_user.email if share_user else "unknown@example.com",
        role=share.role,
    )


@router.delete("/{snapshot_id}/shares/{share_id}")
def delete_share(
    snapshot_id: str,
    share_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    snap = db.query(models.Snapshot).filter(models.Snapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    role = resolve_role(db, snap, user)
    require_role(role, SnapshotRole.admin)
    share = db.query(models.SnapshotShare).filter(models.SnapshotShare.id == share_id).first()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    db.delete(share)
    db.commit()
    return {"ok": True}
