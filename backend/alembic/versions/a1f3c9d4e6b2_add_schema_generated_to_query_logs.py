import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'a1f3c9d4e6b2'
down_revision = '219bd7b0d350'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'query_logs',
        sa.Column(
            'schema_generated',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('query_logs', 'schema_generated')
