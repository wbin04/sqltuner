"""add_action_type_to_query_logs

Revision ID: 219bd7b0d350
Revises: add_simulation_support
Create Date: 2026-01-20 22:12:27.062723

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '219bd7b0d350'
down_revision = 'add_simulation_support'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add action_type column to query_logs table
    op.add_column('query_logs', sa.Column('action_type', sa.String(50), nullable=False, server_default='chat'))


def downgrade() -> None:
    # Remove action_type column from query_logs table
    op.drop_column('query_logs', 'action_type')
