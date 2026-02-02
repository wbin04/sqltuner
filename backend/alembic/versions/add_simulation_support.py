import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'add_simulation_support'
down_revision = '690440cf8cda'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE db_type ADD VALUE 'simulation'")

    op.add_column(
        'db_connections',
        sa.Column(
            'meta_schema',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb")
        )
    )

    op.alter_column('db_connections', 'host',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=True)

    op.alter_column('db_connections', 'db_password',
                    existing_type=sa.VARCHAR(length=500),
                    nullable=True)

    op.alter_column('db_connections', 'db_name',
                    existing_type=sa.VARCHAR(length=100),
                    nullable=True)


def downgrade() -> None:
    op.alter_column('db_connections', 'db_name',
                    existing_type=sa.VARCHAR(length=100),
                    nullable=False)

    op.alter_column('db_connections', 'db_password',
                    existing_type=sa.VARCHAR(length=500),
                    nullable=False)

    op.alter_column('db_connections', 'host',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=False)

    op.drop_column('db_connections', 'meta_schema')
