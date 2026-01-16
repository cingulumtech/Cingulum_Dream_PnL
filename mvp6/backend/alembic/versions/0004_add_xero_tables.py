"""add xero tables

Revision ID: 0004_add_xero_tables
Revises: 0003_add_ledger_tables
Create Date: 2025-09-10 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_add_xero_tables"
down_revision = "0003_add_ledger_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "xero_connections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_table(
        "xero_oauth_states",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("state", sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("xero_oauth_states")
    op.drop_table("xero_connections")
