"""Create background_tasks table with postgres_sandbox enum value
(replaces old add_background_tasks which was stamped but never actually ran)

Revision ID: pg_sandbox_tasks
Revises: add_background_tasks
Create Date: 2026-04-20
"""

revision = 'pg_sandbox_tasks'
down_revision = 'add_background_tasks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op

    # ── 1. Create task_status enum if not exists ──────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'task_status'
            ) THEN
                CREATE TYPE task_status AS ENUM (
                    'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'
                );
            END IF;
        END
        $$
    """)

    # ── 2. Create task_type enum with 'postgres_sandbox' ──────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'task_type'
            ) THEN
                CREATE TYPE task_type AS ENUM (
                    'llm_optimize',
                    'postgres_sandbox',
                    'schema_sync'
                );
            ELSE
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'task_type'
                      AND e.enumlabel = 'postgres_sandbox'
                ) THEN
                    ALTER TYPE task_type ADD VALUE 'postgres_sandbox';
                END IF;
            END IF;
        END
        $$
    """)

    # ── 3. Create background_tasks table if not exists ────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS background_tasks (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
            task_type     task_type NOT NULL,
            status        task_status NOT NULL DEFAULT 'PENDING',
            payload       JSONB NOT NULL DEFAULT '{}',
            result        JSONB,
            error_message TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_background_tasks_user_id
            ON background_tasks(user_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_background_tasks_created_at
            ON background_tasks(created_at)
    """)

    # ── 4. Migrate any existing rows (safety) ─────────────────────────────
    op.execute("""
        UPDATE background_tasks
        SET task_type = 'postgres_sandbox'
        WHERE task_type::text = 'sqlite_sandbox'
    """)


def downgrade() -> None:
    from alembic import op

    op.execute("DROP TABLE IF EXISTS background_tasks")
    op.execute("DROP TYPE IF EXISTS task_type")
    op.execute("DROP TYPE IF EXISTS task_status")
