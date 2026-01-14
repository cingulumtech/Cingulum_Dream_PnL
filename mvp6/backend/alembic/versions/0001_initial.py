"""initial

Revision ID: 0001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def _json_type():
    return sa.JSON()


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'sessions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_sessions_token_hash', 'sessions', ['token_hash'], unique=True)

    op.create_table(
        'user_settings',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False, server_default='Default settings'),
        sa.Column('data', _json_type(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'imports',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('owner_user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('metadata', _json_type(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'mapping_configs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('owner_user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('data', _json_type(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'layout_templates',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('owner_user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('data', _json_type(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'report_configs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('owner_user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('data', _json_type(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'snapshots',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('owner_user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('payload', _json_type(), nullable=False),
        sa.Column('schema_version', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'snapshot_shares',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('snapshot_id', sa.String(length=36), sa.ForeignKey('snapshots.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('snapshot_id', 'user_id', name='uniq_snapshot_user'),
    )



def downgrade():
    op.drop_table('snapshot_shares')
    op.drop_table('snapshots')
    op.drop_table('report_configs')
    op.drop_table('layout_templates')
    op.drop_table('mapping_configs')
    op.drop_table('imports')
    op.drop_table('user_settings')
    op.drop_index('ix_sessions_token_hash', table_name='sessions')
    op.drop_table('sessions')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
