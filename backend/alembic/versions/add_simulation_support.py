"""add simulation support to db_connections

Revision ID: add_simulation_support
Revises: 690440cf8cda
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_simulation_support'
down_revision = '690440cf8cda'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Add 'simulation' value to db_type enum
    op.execute("ALTER TYPE db_type ADD VALUE 'simulation'")
    
    # Step 2: Add meta_schema column (JSONB)
    op.add_column('db_connections', 
        sa.Column('meta_schema', postgresql.JSONB(astext_type=sa.Text()), 
                  nullable=True, server_default=sa.text("'{}'::jsonb"))
    )
    
    # Step 3: Make connection fields nullable (for simulation support)
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
    # Revert nullable changes
    op.alter_column('db_connections', 'db_name',
                    existing_type=sa.VARCHAR(length=100),
                    nullable=False)
    
    op.alter_column('db_connections', 'db_password',
                    existing_type=sa.VARCHAR(length=500),
                    nullable=False)
    
    op.alter_column('db_connections', 'host',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=False)
    
    # Remove meta_schema column
    op.drop_column('db_connections', 'meta_schema')
    
    # Note: PostgreSQL does not support removing enum values directly
    # Manual intervention required to remove 'simulation' from db_type enum
