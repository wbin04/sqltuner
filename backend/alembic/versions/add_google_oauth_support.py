import sqlalchemy as sa
from alembic import op

revision = 'add_google_oauth'
down_revision = 'add_cookie_auth'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('users', 'password',
                    existing_type=sa.String(255),
                    nullable=True)

    op.add_column('users', sa.Column('auth_provider', sa.String(50),
                                     nullable=False, server_default='email'))
    op.add_column('users', sa.Column('google_id', sa.String(255),
                                     nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(500),
                                     nullable=True))

    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)


def downgrade():
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'auth_provider')

    op.alter_column('users', 'password',
                    existing_type=sa.String(255),
                    nullable=False)
