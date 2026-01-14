"""add ledger tables

Revision ID: 0003_add_ledger_tables
Revises: 0002_add_user_role
Create Date: 2025-09-10 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_add_ledger_tables"
down_revision = "0002_add_user_role"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "txn_overrides",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("document_id", sa.String(length=255), nullable=False),
        sa.Column("line_item_id", sa.String(length=255), nullable=True),
        sa.Column("hash", sa.String(length=64), nullable=True),
        sa.Column("treatment", sa.String(length=20), nullable=False, server_default="OPERATING"),
        sa.Column("deferral_start_month", sa.String(length=7), nullable=True),
        sa.Column("deferral_months", sa.Integer(), nullable=True),
        sa.Column("deferral_include_in_operating_kpis", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "user_id", "source", "document_id", "line_item_id", "hash", name="uniq_txn_override"),
    )
    op.create_table(
        "doctor_rules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("contact_id", sa.String(length=255), nullable=False),
        sa.Column("default_treatment", sa.String(length=20), nullable=False, server_default="OPERATING"),
        sa.Column("deferral_start_month", sa.String(length=7), nullable=True),
        sa.Column("deferral_months", sa.Integer(), nullable=True),
        sa.Column("deferral_include_in_operating_kpis", sa.Boolean(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "user_id", "contact_id", name="uniq_doctor_rule"),
    )
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "user_id", "key", name="uniq_user_pref"),
    )


def downgrade():
    op.drop_table("user_preferences")
    op.drop_table("doctor_rules")
    op.drop_table("txn_overrides")
