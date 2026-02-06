import sqlalchemy as sa
from alembic import op

revision = 'add_app_config'
down_revision = 'add_google_oauth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'app_config',
        sa.Column('key', sa.String(255), primary_key=True, nullable=False),
        sa.Column('value', sa.Text(), nullable=True)
    )

    op.execute(
        """
        INSERT INTO app_config (key, value)
        VALUES ('llm_url', 'http://localhost:11434')
        """
    )


def downgrade() -> None:
    op.drop_table('app_config')
