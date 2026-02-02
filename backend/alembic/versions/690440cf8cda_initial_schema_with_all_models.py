import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '690440cf8cda'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        'idx_conversations_conn', table_name='conversations'
    )
    op.create_index(
        op.f('ix_conversations_connection_id'),
        'conversations',
        ['connection_id'],
        unique=False
    )
    op.add_column(
        'db_connections',
        sa.Column('metadata_cache',
                  postgresql.JSONB(astext_type=sa.Text()),
                  nullable=True)
    )
    op.drop_index(
        'idx_connections_user', table_name='db_connections'
    )
    op.create_index(
        op.f('ix_db_connections_user_id'),
        'db_connections',
        ['user_id'],
        unique=False
    )
    op.drop_index(
        'idx_explain_plan',
        table_name='performance_analysis',
        postgresql_using='gin'
    )
    op.drop_index(
        'idx_logs_conversation', table_name='query_logs'
    )
    op.create_index(
        op.f('ix_query_logs_conversation_id'),
        'query_logs',
        ['conversation_id'],
        unique=False
    )
    op.drop_constraint(
        'users_email_key', 'users', type_='unique'
    )
    op.create_index(
        op.f('ix_users_email'), 'users', ['email'], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.create_unique_constraint('users_email_key', 'users', ['email'])
    op.drop_index(op.f('ix_query_logs_conversation_id'),
                  table_name='query_logs')
    op.create_index(
        'idx_logs_conversation',
        'query_logs',
        ['conversation_id'],
        unique=False
    )
    op.create_index(
        'idx_explain_plan',
        'performance_analysis',
        ['explain_plan'],
        unique=False,
        postgresql_using='gin'
    )
    op.drop_index(
        op.f('ix_db_connections_user_id'), table_name='db_connections'
    )
    op.create_index(
        'idx_connections_user',
        'db_connections',
        ['user_id'],
        unique=False
    )
    op.drop_column(
        'db_connections', 'metadata_cache'
    )
    op.drop_index(
        op.f('ix_conversations_connection_id'), table_name='conversations'
    )
    op.create_index(
        'idx_conversations_conn',
        'conversations',
        ['connection_id'],
        unique=False
    )
