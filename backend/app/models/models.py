import enum
import uuid

from sqlalchemy import TIMESTAMP, Column
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


# Enum Types
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class DBType(str, enum.Enum):
    POSTGRES = "postgres"
    MYSQL = "mysql"
    SIMULATION = "simulation"


class ChatRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


# Models
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password = Column(String(255), nullable=False)
    role = Column(
        SQLEnum(
            UserRole,
            name="user_role",
            values_callable=lambda x: [
                e.value for e in x]),
        default=UserRole.USER)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    db_connections = relationship(
        "DBConnection",
        back_populates="user",
        cascade="all, delete-orphan")


class DBConnection(Base):
    __tablename__ = "db_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(
            as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE"),
        nullable=False,
        index=True)
    name = Column(String(100), nullable=False)
    host = Column(String(255), nullable=True)  # Nullable for simulation
    port = Column(Integer, default=5432)
    username = Column(String(100))
    db_password = Column(String(500), nullable=True)  # Nullable for simulation
    db_name = Column(String(100), nullable=True)  # Nullable for simulation
    db_type = Column(
        SQLEnum(
            DBType,
            name="db_type",
            values_callable=lambda x: [
                e.value for e in x]),
        default=DBType.POSTGRES)
    meta_schema = Column(
        JSONB,
        nullable=True,
        server_default="{}")  # Unified schema storage
    # Legacy field, can be deprecated
    metadata_cache = Column(JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="db_connections")
    conversations = relationship("Conversation", back_populates="connection")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(
        UUID(
            as_uuid=True),
        ForeignKey(
            "db_connections.id",
            ondelete="SET NULL"),
        index=True)
    title = Column(String(255))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    connection = relationship("DBConnection", back_populates="conversations")
    query_logs = relationship(
        "QueryLog",
        back_populates="conversation",
        cascade="all, delete-orphan")


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(
            as_uuid=True),
        ForeignKey(
            "conversations.id",
            ondelete="CASCADE"),
        nullable=False,
        index=True)
    role = Column(
        SQLEnum(
            ChatRole,
            name="chat_role",
            values_callable=lambda x: [
                e.value for e in x]),
        nullable=False)
    action_type = Column(
        String(50),
        nullable=False,
        default='chat')  # chat, explain, optimize
    content = Column(Text, nullable=False)
    sql_generated = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="query_logs")
    feedback = relationship(
        "Feedback",
        back_populates="query_log",
        uselist=False)
    performance_analysis = relationship(
        "PerformanceAnalysis",
        back_populates="query_log",
        uselist=False)


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_log_id = Column(
        UUID(
            as_uuid=True),
        ForeignKey(
            "query_logs.id",
            ondelete="CASCADE"),
        nullable=False,
        unique=True)
    rating = Column(Integer)
    corrected_sql = Column(Text)
    comment = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    query_log = relationship("QueryLog", back_populates="feedback")


class PerformanceAnalysis(Base):
    __tablename__ = "performance_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_log_id = Column(
        UUID(
            as_uuid=True),
        ForeignKey(
            "query_logs.id",
            ondelete="CASCADE"),
        nullable=False,
        unique=True)
    execution_time_ms = Column(Float)
    total_cost = Column(Float)
    explain_plan = Column(JSONB, nullable=False)
    index_recommendation = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    query_log = relationship("QueryLog", back_populates="performance_analysis")
