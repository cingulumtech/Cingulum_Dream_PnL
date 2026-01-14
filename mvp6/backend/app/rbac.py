from enum import Enum
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from . import models


class SnapshotRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


ROLE_PRIORITY = {
    SnapshotRole.owner: 3,
    SnapshotRole.admin: 2,
    SnapshotRole.editor: 1,
    SnapshotRole.viewer: 0,
}


def resolve_role(db: Session, snapshot: models.Snapshot, user: models.User) -> SnapshotRole | None:
    if getattr(user, "role", "viewer") == "super_admin":
        return SnapshotRole.owner
    if snapshot.owner_user_id == user.id:
        return SnapshotRole.owner
    share = (
        db.query(models.SnapshotShare)
        .filter(models.SnapshotShare.snapshot_id == snapshot.id)
        .filter(models.SnapshotShare.user_id == user.id)
        .first()
    )
    if not share:
        return None
    return SnapshotRole(share.role)


def require_role(role: SnapshotRole | None, minimum: SnapshotRole) -> None:
    if role is None or ROLE_PRIORITY[role] < ROLE_PRIORITY[minimum]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
