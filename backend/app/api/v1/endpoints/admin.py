"""
Admin API endpoints.
All endpoints require admin role.
Provides dashboard stats, user management, and DB connection management.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from app.api.v1.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.models import (
    DBConnection, Feedback, QueryLog, User, UserRole,
    Conversation
)
from app.repositories.user_repository import user_repository
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, case, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Guards ───────────────────────────────────────────────────────────────────

async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ─── Schemas ──────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_connections: int
    total_queries: int
    total_conversations: int
    total_feedbacks: int
    thumbs_up: int
    thumbs_down: int


class QueriesPerHour(BaseModel):
    hour: str
    queries: int


class SatisfactionDay(BaseModel):
    date: str
    thumbs_up: int
    thumbs_down: int


class RecentActivity(BaseModel):
    user_email: str
    action: str
    time: str


class DashboardResponse(BaseModel):
    stats: DashboardStats
    queries_per_hour: List[QueriesPerHour]
    satisfaction_trend: List[SatisfactionDay]
    recent_activity: List[RecentActivity]


class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    is_active: bool
    auth_provider: str
    created_at: datetime
    connections_count: int
    queries_count: int

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AdminConnectionResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    name: str
    db_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    db_name: Optional[str] = None
    tables_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated dashboard stats for admin overview."""

    # Basic counts
    total_users = (await db.execute(
        select(func.count()).select_from(User)
    )).scalar() or 0

    active_users = (await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )).scalar() or 0

    total_connections = (await db.execute(
        select(func.count()).select_from(DBConnection)
    )).scalar() or 0

    total_queries = (await db.execute(
        select(func.count()).select_from(QueryLog)
    )).scalar() or 0

    total_conversations = (await db.execute(
        select(func.count()).select_from(Conversation)
    )).scalar() or 0

    total_feedbacks = (await db.execute(
        select(func.count()).select_from(Feedback)
    )).scalar() or 0

    # Feedback breakdown
    thumbs_up = (await db.execute(
        select(func.count()).select_from(Feedback).where(Feedback.rating >= 4)
    )).scalar() or 0

    thumbs_down = (await db.execute(
        select(func.count()).select_from(Feedback).where(Feedback.rating <= 2)
    )).scalar() or 0

    stats = DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_connections=total_connections,
        total_queries=total_queries,
        total_conversations=total_conversations,
        total_feedbacks=total_feedbacks,
        thumbs_up=thumbs_up,
        thumbs_down=thumbs_down,
    )

    # Queries per hour (last 24h)
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    rows = (await db.execute(
        select(
            func.date_trunc('hour', QueryLog.created_at).label('hour'),
            func.count().label('cnt'),
        )
        .where(QueryLog.created_at >= since_24h)
        .group_by('hour')
        .order_by('hour')
    )).all()

    qph: List[QueriesPerHour] = []
    for r in rows:
        qph.append(QueriesPerHour(
            hour=r.hour.strftime('%H:%M') if r.hour else '00:00',
            queries=r.cnt,
        ))

    # If no data, provide empty placeholders
    if not qph:
        for h in range(0, 24, 3):
            qph.append(QueriesPerHour(hour=f'{h:02d}:00', queries=0))

    # Satisfaction trend (last 7 days)
    since_7d = now - timedelta(days=7)
    sat_rows = (await db.execute(
        select(
            func.date_trunc('day', Feedback.created_at).label('day'),
            func.count().filter(Feedback.rating >= 4).label('up'),
            func.count().filter(Feedback.rating <= 2).label('down'),
        )
        .where(Feedback.created_at >= since_7d)
        .group_by('day')
        .order_by('day')
    )).all()

    sat: List[SatisfactionDay] = []
    for r in sat_rows:
        sat.append(SatisfactionDay(
            date=r.day.strftime('%a') if r.day else '',
            thumbs_up=r.up or 0,
            thumbs_down=r.down or 0,
        ))

    if not sat:
        weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        for d in weekdays:
            sat.append(SatisfactionDay(date=d, thumbs_up=0, thumbs_down=0))

    # Recent activity (latest 10 query logs)
    recent_rows = (await db.execute(
        select(QueryLog, Conversation, DBConnection, User)
        .outerjoin(Conversation, QueryLog.conversation_id == Conversation.id)
        .outerjoin(DBConnection, Conversation.connection_id == DBConnection.id)
        .outerjoin(User, DBConnection.user_id == User.id)
        .order_by(QueryLog.created_at.desc())
        .limit(10)
    )).all()

    activity: List[RecentActivity] = []
    for row in recent_rows:
        ql = row[0]  # QueryLog
        user = row[3]  # User (might be None)
        email = user.email if user else 'unknown'
        action_map = {
            'chat': 'sent a chat message',
            'generate': 'generated SQL',
            'execute': 'executed a query',
            'explain': 'ran explain analysis',
            'optimize': 'optimized a query',
            'check': 'validated SQL syntax',
        }
        action = action_map.get(ql.action_type, f'performed {ql.action_type}')

        # Time ago
        if ql.created_at:
            diff = now - ql.created_at.replace(tzinfo=timezone.utc) if ql.created_at.tzinfo is None else now - ql.created_at
            mins = int(diff.total_seconds() / 60)
            if mins < 1:
                time_str = 'just now'
            elif mins < 60:
                time_str = f'{mins} min ago'
            elif mins < 1440:
                time_str = f'{mins // 60}h ago'
            else:
                time_str = f'{mins // 1440}d ago'
        else:
            time_str = ''

        activity.append(RecentActivity(
            user_email=email,
            action=action,
            time=time_str,
        ))

    return DashboardResponse(
        stats=stats,
        queries_per_hour=qph,
        satisfaction_trend=sat,
        recent_activity=activity,
    )


# ─── User Management ─────────────────────────────────────────────────────────

@router.get("/users", response_model=List[AdminUserResponse])
async def list_users(
    search: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users with their connection and query counts."""
    # Sub-queries for counts
    conn_count = (
        select(func.count())
        .where(DBConnection.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    query_count = (
        select(func.count())
        .select_from(QueryLog)
        .join(Conversation, QueryLog.conversation_id == Conversation.id)
        .join(DBConnection, Conversation.connection_id == DBConnection.id)
        .where(DBConnection.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    stmt = (
        select(
            User,
            conn_count.label('connections_count'),
            query_count.label('queries_count'),
        )
        .order_by(User.created_at.desc())
    )

    if search:
        stmt = stmt.where(User.email.ilike(f'%{search}%'))

    rows = (await db.execute(stmt)).all()

    results: List[AdminUserResponse] = []
    for row in rows:
        u = row[0]
        results.append(AdminUserResponse(
            id=u.id,
            email=u.email,
            role=u.role.value if u.role else 'user',
            is_active=u.is_active,
            auth_provider=u.auth_provider or 'email',
            created_at=u.created_at,
            connections_count=row[1] or 0,
            queries_count=row[2] or 0,
        ))

    return results


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: UUID,
    update_data: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's role or active status."""
    user = await user_repository.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from deactivating themselves
    if user.id == admin.id and update_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own admin account",
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    if 'role' in update_dict:
        update_dict['role'] = UserRole(update_dict['role'])

    updated = await user_repository.update(db, db_obj=user, obj_in=update_dict)

    # Re-query counts
    conn_count = (await db.execute(
        select(func.count()).select_from(DBConnection).where(
            DBConnection.user_id == user_id
        )
    )).scalar() or 0

    query_count = (await db.execute(
        select(func.count())
        .select_from(QueryLog)
        .join(Conversation, QueryLog.conversation_id == Conversation.id)
        .join(DBConnection, Conversation.connection_id == DBConnection.id)
        .where(DBConnection.user_id == user_id)
    )).scalar() or 0

    return AdminUserResponse(
        id=updated.id,
        email=updated.email,
        role=updated.role.value if updated.role else 'user',
        is_active=updated.is_active,
        auth_provider=updated.auth_provider or 'email',
        created_at=updated.created_at,
        connections_count=conn_count,
        queries_count=query_count,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user and all their data."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account",
        )

    deleted = await user_repository.delete(db, id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )


# ─── DB Connections (Admin View) ──────────────────────────────────────────────

@router.get("/connections", response_model=List[AdminConnectionResponse])
async def list_all_connections(
    search: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all DB connections across all users."""
    stmt = (
        select(DBConnection, User.email)
        .outerjoin(User, DBConnection.user_id == User.id)
        .order_by(DBConnection.created_at.desc())
    )

    if search:
        stmt = stmt.where(
            DBConnection.name.ilike(f'%{search}%')
            | User.email.ilike(f'%{search}%')
        )

    rows = (await db.execute(stmt)).all()

    results: List[AdminConnectionResponse] = []
    for row in rows:
        conn = row[0]
        user_email = row[1] or 'unknown'

        # Count tables from meta_schema
        tables_count = 0
        if conn.meta_schema and isinstance(conn.meta_schema, dict):
            tables = conn.meta_schema.get('tables', [])
            tables_count = len(tables) if isinstance(tables, list) else 0

        results.append(AdminConnectionResponse(
            id=conn.id,
            user_id=conn.user_id,
            user_email=user_email,
            name=conn.name,
            db_type=conn.db_type.value if conn.db_type else 'unknown',
            host=conn.host,
            port=conn.port,
            db_name=conn.db_name,
            tables_count=tables_count,
            created_at=conn.created_at,
        ))

    return results
