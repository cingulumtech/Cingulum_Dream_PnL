from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, require_csrf

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("/overrides", response_model=list[schemas.TxnOverrideOut])
def list_overrides(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    records = (
        db.query(models.TxnOverride)
        .filter(models.TxnOverride.user_id == user.id, models.TxnOverride.tenant_id == user.id)
        .all()
    )
    return [schemas.TxnOverrideOut.model_validate(record) for record in records]


@router.put("/overrides", response_model=schemas.TxnOverrideOut)
def upsert_override(
    payload: schemas.TxnOverridePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = (
        db.query(models.TxnOverride)
        .filter(
            models.TxnOverride.tenant_id == user.id,
            models.TxnOverride.user_id == user.id,
            models.TxnOverride.source == payload.source,
            models.TxnOverride.document_id == payload.document_id,
            models.TxnOverride.line_item_id == payload.line_item_id,
            models.TxnOverride.hash == payload.hash,
        )
        .first()
    )
    if record:
        record.treatment = payload.treatment
        record.deferral_start_month = payload.deferral_start_month
        record.deferral_months = payload.deferral_months
        record.deferral_include_in_operating_kpis = payload.deferral_include_in_operating_kpis
    else:
        record = models.TxnOverride(
            tenant_id=user.id,
            user_id=user.id,
            source=payload.source,
            document_id=payload.document_id,
            line_item_id=payload.line_item_id,
            hash=payload.hash,
            treatment=payload.treatment,
            deferral_start_month=payload.deferral_start_month,
            deferral_months=payload.deferral_months,
            deferral_include_in_operating_kpis=payload.deferral_include_in_operating_kpis,
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.TxnOverrideOut.model_validate(record)


@router.delete("/overrides/{override_id}")
def delete_override(
    override_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = (
        db.query(models.TxnOverride)
        .filter(
            models.TxnOverride.id == override_id,
            models.TxnOverride.user_id == user.id,
            models.TxnOverride.tenant_id == user.id,
        )
        .first()
    )
    if record:
        db.delete(record)
        db.commit()
    return {"ok": True}


@router.get("/doctor-rules", response_model=list[schemas.DoctorRuleOut])
def list_doctor_rules(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    records = (
        db.query(models.DoctorRule)
        .filter(models.DoctorRule.user_id == user.id, models.DoctorRule.tenant_id == user.id)
        .all()
    )
    return [schemas.DoctorRuleOut.model_validate(record) for record in records]


@router.put("/doctor-rules", response_model=schemas.DoctorRuleOut)
def upsert_doctor_rule(
    payload: schemas.DoctorRulePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = (
        db.query(models.DoctorRule)
        .filter(
            models.DoctorRule.tenant_id == user.id,
            models.DoctorRule.user_id == user.id,
            models.DoctorRule.contact_id == payload.contact_id,
        )
        .first()
    )
    if record:
        record.default_treatment = payload.default_treatment
        record.deferral_start_month = payload.deferral_start_month
        record.deferral_months = payload.deferral_months
        record.deferral_include_in_operating_kpis = payload.deferral_include_in_operating_kpis
        record.enabled = payload.enabled
    else:
        record = models.DoctorRule(
            tenant_id=user.id,
            user_id=user.id,
            contact_id=payload.contact_id,
            default_treatment=payload.default_treatment,
            deferral_start_month=payload.deferral_start_month,
            deferral_months=payload.deferral_months,
            deferral_include_in_operating_kpis=payload.deferral_include_in_operating_kpis,
            enabled=payload.enabled,
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.DoctorRuleOut.model_validate(record)


@router.delete("/doctor-rules/{contact_id}")
def delete_doctor_rule(
    contact_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = (
        db.query(models.DoctorRule)
        .filter(
            models.DoctorRule.contact_id == contact_id,
            models.DoctorRule.user_id == user.id,
            models.DoctorRule.tenant_id == user.id,
        )
        .first()
    )
    if record:
        db.delete(record)
        db.commit()
    return {"ok": True}


@router.get("/preferences/{key}", response_model=schemas.UserPreferenceOut | None)
def get_preference(
    key: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    record = (
        db.query(models.UserPreference)
        .filter(
            models.UserPreference.key == key,
            models.UserPreference.user_id == user.id,
            models.UserPreference.tenant_id == user.id,
        )
        .first()
    )
    if not record:
        return None
    return schemas.UserPreferenceOut.model_validate(record)


@router.put("/preferences/{key}", response_model=schemas.UserPreferenceOut)
def upsert_preference(
    key: str,
    payload: schemas.UserPreferencePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_csrf(request)
    record = (
        db.query(models.UserPreference)
        .filter(
            models.UserPreference.key == key,
            models.UserPreference.user_id == user.id,
            models.UserPreference.tenant_id == user.id,
        )
        .first()
    )
    if record:
        record.value_json = payload.value_json
    else:
        record = models.UserPreference(
            tenant_id=user.id,
            user_id=user.id,
            key=key,
            value_json=payload.value_json,
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.UserPreferenceOut.model_validate(record)
