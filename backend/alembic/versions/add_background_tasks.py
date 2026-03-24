import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'add_background_tasks'
down_revision = 'add_simulation_support'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE task_type AS ENUM (
            'llm_optimize',
            'sqlite_sandbox',
            'schema_sync'
        )
    """)

    op.execute("""
        CREATE TYPE task_status AS ENUM (
            'PENDING',
            'PROCESSING',
            'SUCCESS',
            'FAILED'
        )
    """)

    op.create_table(
        'background_tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
            index=True
        ),
        sa.Column('task_type', sa.Enum(
            'llm_optimize',
            'sqlite_sandbox',
            'schema_sync',
            name='task_type'
        ), nullable=False),
        sa.Column('status', sa.Enum(
            'PENDING',
            'PROCESSING',
            'SUCCESS',
            'FAILED',
            name='task_status'
        ), nullable=False, server_default='PENDING'),
        sa.Column(
            'payload',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column(
            'result',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True
        ),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        sa.Column(
            'updated_at',
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        )
    )

    op.create_index(
        'ix_background_tasks_created_at',
        'background_tasks',
        ['created_at']
    )


def downgrade() -> None:
    op.drop_index('ix_background_tasks_created_at',
                  table_name='background_tasks')

    op.drop_table('background_tasks')

    op.execute("DROP TYPE task_status")
    op.execute("DROP TYPE task_type")
