"""add user role

Revision ID: 0002_add_user_role
Revises: 0001_initial
Create Date: 2024-01-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_add_user_role'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('role', sa.String(length=40), nullable=False, server_default='viewer'))
    op.execute("UPDATE users SET role = 'super_admin' WHERE id IN (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)")
    op.alter_column('users', 'role', server_default=None)


def downgrade():
    op.drop_column('users', 'role')
