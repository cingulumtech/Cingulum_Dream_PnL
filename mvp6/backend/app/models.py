import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON
from .db import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def json_type():
    return JSON


class User(Base):
    __tablename__ = 'users'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(40), nullable=False, default='viewer')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sessions = relationship('Session', back_populates='user', cascade='all, delete-orphan')


class Session(Base):
    __tablename__ = 'sessions'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship('User', back_populates='sessions')


class UserSettings(Base):
    __tablename__ = 'user_settings'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    name = Column(String(255), nullable=False, default="Default settings")
    data = Column(json_type(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ImportRecord(Base):
    __tablename__ = 'imports'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    kind = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False)
    meta = Column('metadata', json_type(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class MappingConfig(Base):
    __tablename__ = 'mapping_configs'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    data = Column(json_type(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class LayoutTemplate(Base):
    __tablename__ = 'layout_templates'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    data = Column(json_type(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ReportConfig(Base):
    __tablename__ = 'report_configs'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    data = Column(json_type(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Snapshot(Base):
    __tablename__ = 'snapshots'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    payload = Column(json_type(), nullable=False)
    schema_version = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    shares = relationship('SnapshotShare', back_populates='snapshot', cascade='all, delete-orphan')


class SnapshotShare(Base):
    __tablename__ = 'snapshot_shares'
    __table_args__ = (UniqueConstraint('snapshot_id', 'user_id', name='uniq_snapshot_user'),)

    id = Column(String(36), primary_key=True, default=generate_uuid)
    snapshot_id = Column(String(36), ForeignKey('snapshots.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    snapshot = relationship('Snapshot', back_populates='shares')
    user = relationship('User')


class TxnOverride(Base):
    __tablename__ = 'txn_overrides'
    __table_args__ = (
        UniqueConstraint(
            'tenant_id',
            'user_id',
            'source',
            'document_id',
            'line_item_id',
            'hash',
            name='uniq_txn_override',
        ),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    source = Column(String(40), nullable=False)
    document_id = Column(String(255), nullable=False)
    line_item_id = Column(String(255), nullable=True)
    hash = Column(String(64), nullable=True)
    treatment = Column(String(20), nullable=False, default='OPERATING')
    deferral_start_month = Column(String(7), nullable=True)
    deferral_months = Column(Integer, nullable=True)
    deferral_include_in_operating_kpis = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class DoctorRule(Base):
    __tablename__ = 'doctor_rules'
    __table_args__ = (
        UniqueConstraint('tenant_id', 'user_id', 'contact_id', name='uniq_doctor_rule'),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    contact_id = Column(String(255), nullable=False)
    default_treatment = Column(String(20), nullable=False, default='OPERATING')
    deferral_start_month = Column(String(7), nullable=True)
    deferral_months = Column(Integer, nullable=True)
    deferral_include_in_operating_kpis = Column(Boolean, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UserPreference(Base):
    __tablename__ = 'user_preferences'
    __table_args__ = (UniqueConstraint('tenant_id', 'user_id', 'key', name='uniq_user_pref'),)

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    key = Column(String(100), nullable=False)
    value_json = Column(json_type(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
