import sqlalchemy as sa
from alembic import op

revision = '219bd7b0d350'
down_revision = 'add_simulation_support'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'query_logs',
        sa.Column(
            'action_type',
            sa.String(50),
            nullable=False,
            server_default='chat'
        )
    )


def downgrade() -> None:
    op.drop_column('query_logs', 'action_type')
