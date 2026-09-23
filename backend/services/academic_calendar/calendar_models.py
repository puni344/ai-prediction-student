"""Academic Calendar and Holiday database models.

Supports:
- Official AP Government holidays (G.O. Rt. No. 2276)
- Holiday API (IN-AP) enrichment
- Student personal overrides
- Admin/institution-wide overrides
- 6-tier day resolution priority
"""
from datetime import datetime, timezone
from typing import Optional
import enum

from sqlalchemy import (
    String, Integer, Float, DateTime, Date, ForeignKey,
    Boolean, Enum as SAEnum, UniqueConstraint, Index, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


# --- Enums ---

class HolidayCategory(str, enum.Enum):
    """Classification of calendar entries."""
    PUBLIC_HOLIDAY = "PUBLIC_HOLIDAY"
    OPTIONAL_HOLIDAY = "OPTIONAL_HOLIDAY"
    FESTIVAL = "FESTIVAL"
    OBSERVANCE = "OBSERVANCE"
    WEEKLY_OFF = "WEEKLY_OFF"
    SPECIAL_NON_WORKING_DAY = "SPECIAL_NON_WORKING_DAY"


class HolidaySource(str, enum.Enum):
    """Provenance of calendar entry."""
    AP_GOVERNMENT = "AP_GOVERNMENT"
    CALENDARIFIC = "CALENDARIFIC"
    HOLIDAY_API = "HOLIDAY_API"
    ADMIN_MANUAL = "ADMIN_MANUAL"


class OverrideType(str, enum.Enum):
    """Types of calendar overrides."""
    COLLEGE_DAY = "COLLEGE_DAY"
    HOLIDAY = "HOLIDAY"
    NORMAL_DAY = "NORMAL_DAY"


class DayFinalStatus(str, enum.Enum):
    """Resolved final status of a calendar day."""
    COLLEGE_DAY = "COLLEGE_DAY"
    HOLIDAY = "HOLIDAY"
    OPTIONAL_HOLIDAY = "OPTIONAL_HOLIDAY"
    SUNDAY_OFF = "SUNDAY_OFF"
    NORMAL_DAY = "NORMAL_DAY"


# --- Academic Calendar ---

class AcademicCalendar(Base):
    """Master academic calendar with holidays from multiple sources.

    Source priority (higher = more authoritative):
    - AP_GOVERNMENT: 100 (official government orders)
    - ADMIN_MANUAL: 75 (institution-specific)
    - HOLIDAY_API: 50 (third-party enrichment)
    """
    __tablename__ = "academic_calendar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    calendar_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    state_code: Mapped[str] = mapped_column(String(10), default="IN-AP")

    holiday_category: Mapped[str] = mapped_column(
        String(30),
        default=HolidayCategory.PUBLIC_HOLIDAY.value,
        nullable=False,
    )
    holiday_source: Mapped[str] = mapped_column(
        String(20),
        default=HolidaySource.HOLIDAY_API.value,
        nullable=False,
    )
    source_priority: Mapped[int] = mapped_column(
        Integer, default=50, nullable=False,
    )

    is_public_holiday: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default_no_college: Mapped[bool] = mapped_column(Boolean, default=True)
    observed_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("date", "holiday_source", name="uq_calendar_date_source"),
        Index("ix_calendar_year_state", "calendar_year", "state_code"),
    )


# --- Student Calendar Override ---

class StudentCalendarOverride(Base):
    """Student-specific calendar overrides."""
    __tablename__ = "student_calendar_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    override_type: Mapped[str] = mapped_column(String(20), nullable=False)
    college_status: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_student_calendar_override"),
    )


# --- Admin/Institution Calendar Override ---

class AdminCalendarOverride(Base):
    """Institution-wide calendar overrides set by admin."""
    __tablename__ = "admin_calendar_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False, unique=True, index=True)
    override_type: Mapped[str] = mapped_column(String(20), nullable=False)
    college_status: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
