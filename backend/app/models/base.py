from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Index
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, validates
from uuid import uuid4
from app.core.db import Base


class Bot(Base):
    __tablename__ = "bots"
    __table_args__ = (
        Index('idx_bot_bot_index', 'bot_index'),
        Index('idx_bot_created_at', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    bot_index = Column(Integer, nullable=False, unique=True, index=True, comment="External bot ID managed by user")
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # Relationships
    bot_versions = relationship("BotVersion", back_populates="bot", cascade="all, delete-orphan")

    @validates('name')
    def validate_name(self, key, name):
        if not name or not name.strip():
            raise ValueError("Bot name cannot be empty")
        return name.strip()

    @validates('bot_index')
    def validate_bot_index(self, key, bot_index):
        if bot_index is None or bot_index <= 0:
            raise ValueError("Bot ID must be a positive integer")
        return bot_index

    def __repr__(self):
        return f"<Bot(id={self.id}, bot_index={self.bot_index}, name='{self.name}')>"


class BotVersion(Base):
    __tablename__ = "bot_versions"
    __table_args__ = (
        Index('idx_bot_version_bot_index', 'bot_index'),
        Index('idx_bot_version_created_at', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    bot_index = Column(Integer, ForeignKey("bots.bot_index", ondelete="CASCADE"), nullable=False, index=True)
    system_prompt = Column(Text, nullable=False)
    knowledge_base = Column(JSONB, nullable=False, default=lambda: {})
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # Relationships
    bot = relationship("Bot", back_populates="bot_versions")

    @validates('system_prompt')
    def validate_system_prompt(self, key, prompt):
        if not prompt or not prompt.strip():
            raise ValueError("System prompt cannot be empty")
        return prompt.strip()

    def __repr__(self):
        return f"<BotVersion(id={self.id}, bot_index={self.bot_index})>"


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        Index('idx_evaluation_conversation_id', 'conversation_id'),
        Index('idx_evaluation_created_at', 'created_at'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(Text, nullable=False, unique=True, index=True)
    memory = Column(JSONB, nullable=False, default=lambda: {})
    evaluation_result = Column(JSONB, nullable=False, default=lambda: {})
    # Review metadata
    reviewed = Column(sa.Boolean, nullable=False, server_default=sa.text("false"))
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    @validates('evaluation_result')
    def validate_evaluation_result(self, key, result):
        if not result:
            raise ValueError("Evaluation result cannot be empty")
        return result

    @validates('memory')
    def validate_memory(self, key, memory):
        if not memory:
            raise ValueError("Memory cannot be empty")
        return memory

    def __repr__(self):
        return f"<Evaluation(id={self.id}, conversation_id={self.conversation_id}, evaluation_result={self.evaluation_result})>"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    username = Column(String(50), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}')>"