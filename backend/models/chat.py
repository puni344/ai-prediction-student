"""Database models for AI chat sessions and messages."""
from datetime import datetime
from typing import List, Optional, Any
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class ChatSession(Base):
    """Chat session initiated by an authenticated student."""

    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="Academic Advisory Session")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    student: Mapped["StudentProfile"] = relationship("StudentProfile")  # type: ignore # noqa: F821
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base):
    """Individual message in an academic chat session."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # "user", "assistant", "system"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    context_snapshot: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


    @property
    def context_used(self) -> List[str]:
        if self.context_snapshot and isinstance(self.context_snapshot, dict):
            return self.context_snapshot.get('context_used', [])
        return []

    @property
    def capability_used(self) -> str:
        if self.context_snapshot and isinstance(self.context_snapshot, dict):
            return self.context_snapshot.get('capability_used', 'GENERAL_CHAT')
        return 'GENERAL_CHAT'

    @property
    def ai_status(self) -> str:
        if self.context_snapshot and isinstance(self.context_snapshot, dict):
            return self.context_snapshot.get('ai_status', 'live_gemini')
        return 'live_gemini'
