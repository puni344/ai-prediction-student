"""Student Timetable Preferences, Holidays, and Calendar Settings database models."""
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class StudentTimetablePreference(Base):
    __tablename__ = "student_timetable_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    college_start: Mapped[str] = mapped_column(String(10), default="09:00")
    college_end: Mapped[str] = mapped_column(String(10), default="16:00")
    daily_study_hours: Mapped[float] = mapped_column(Float, default=2.0)
    sleep_hours: Mapped[float] = mapped_column(Float, default=8.0)
    sleep_start: Mapped[str] = mapped_column(String(10), default="23:00")
    sleep_end: Mapped[str] = mapped_column(String(10), default="07:00")
    rest_minutes: Mapped[int] = mapped_column(Integer, default=15)
    break_reserve_minutes: Mapped[int] = mapped_column(Integer, default=120)
    meal_minutes: Mapped[int] = mapped_column(Integer, default=30)
    breakfast_start: Mapped[str] = mapped_column(String(10), default="08:00")
    breakfast_duration: Mapped[int] = mapped_column(Integer, default=30)
    lunch_start: Mapped[str] = mapped_column(String(10), default="12:00")
    lunch_duration: Mapped[int] = mapped_column(Integer, default=60)
    dinner_start: Mapped[str] = mapped_column(String(10), default="20:00")
    dinner_duration: Mapped[int] = mapped_column(Integer, default=30)
    preferred_study_period: Mapped[str] = mapped_column(String(20), default="evening")
    session_length_preference: Mapped[str] = mapped_column(String(20), default="standard")
    sleep_is_fixed: Mapped[bool] = mapped_column(Boolean, default=False)
    min_sleep_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_sleep_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_study_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_study_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Future weekly planner extension fields
    day_of_week: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    custom_day_preferences: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class StudentHoliday(Base):
    """Date-specific holiday record for a student."""
    __tablename__ = "student_holidays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    holiday_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    label: Mapped[str] = mapped_column(String(100), default="College Holiday")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("student_id", "holiday_date", name="uq_student_holiday_date"),
    )


class StudentCalendarSetting(Base):
    """Google Calendar connection setting and cached busy intervals."""
    __tablename__ = "student_calendar_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    calendar_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    calendar_id: Mapped[str] = mapped_column(String(255), default="primary")
    access_token: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    mock_events_json: Mapped[Optional[str]] = mapped_column(String(4000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
