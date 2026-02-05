from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'add_cookie_auth'
down_revision: Union[str, None] = '219bd7b0d350'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_active',
                  sa.Boolean(),
                  nullable=False,
                  server_default='true')
    )

    op.create_table(
        'user_sessions',
        sa.Column('session_id',
                  postgresql.UUID(as_uuid=True),
                  nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('refresh_token',
                  sa.String(length=500),
                  nullable=False),
        sa.Column('user_agent',
                  sa.String(length=500),
                  nullable=True),
        sa.Column('ip_address',
                  sa.String(length=50),
                  nullable=True),
        sa.Column('expires_at',
                  sa.TIMESTAMP(timezone=True),
                  nullable=False),
        sa.Column('created_at',
                  sa.TIMESTAMP(timezone=True),
                  server_default=sa.text('now()'),
                  nullable=True),
        sa.Column('is_revoked',
                  sa.Boolean(),
                  nullable=False,
                  server_default='false'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('session_id')
    )

    op.create_index('ix_user_sessions_user_id',
                    'user_sessions',
                    ['user_id'])
    op.create_index('ix_user_sessions_refresh_token',
                    'user_sessions',
                    ['refresh_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_user_sessions_refresh_token', table_name='user_sessions')
    op.drop_index('ix_user_sessions_user_id', table_name='user_sessions')
    op.drop_table('user_sessions')

    op.drop_column('users', 'is_active')
