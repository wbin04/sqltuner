"""add execution time metrics to performance_analysis

Revision ID: add_exec_time_metrics
Revises: add_background_tasks
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_exec_time_metrics'
down_revision = 'add_background_tasks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Thêm cột mới lưu thời gian thực tế (ms)
    op.add_column(
        'performance_analysis',
        sa.Column('original_time_ms', sa.Float(), nullable=True)
    )
    op.add_column(
        'performance_analysis',
        sa.Column('optimized_time_ms', sa.Float(), nullable=True)
    )
    # Giữ nguyên total_cost để backward compatible với data cũ
    # (có thể drop sau khi đã xác nhận production ổn định)


def downgrade() -> None:
    op.drop_column('performance_analysis', 'original_time_ms')
    op.drop_column('performance_analysis', 'optimized_time_ms')
