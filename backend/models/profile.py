"""StudentProfile and FacultyProfile database models."""
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    roll_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    program: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default=None)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default=None)
    academic_year: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default=None)

    @property
    def program_id(self) -> Optional[str]:
        return self.program

    @program_id.setter
    def program_id(self, val: Optional[str]):
        self.program = val

    # Baseline ML input features
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default=None)
    attendance: Mapped[float] = mapped_column(Float, default=0.0)
    study_hours: Mapped[float] = mapped_column(Float, default=0.0)
    sleep_hours: Mapped[float] = mapped_column(Float, default=0.0)
    assignments_completed: Mapped[float] = mapped_column(Float, default=0.0)
    previous_grade: Mapped[float] = mapped_column(Float, default=0.0)
    parent_education: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default=None)
    internet_access: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default=None)
    family_income: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default=None)
    extra_classes: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default=None)
    participation: Mapped[float] = mapped_column(Float, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", back_populates="student_profile")
    department_rel: Mapped[Optional["Department"]] = relationship("Department", back_populates="student_profiles")
    predictions: Mapped[List["PredictionRecord"]] = relationship(
        "PredictionRecord",
        back_populates="student",
        cascade="all, delete-orphan",
    )
    daily_snapshots: Mapped[List["DailyPredictionSnapshot"]] = relationship(
        "DailyPredictionSnapshot",
        back_populates="student",
        cascade="all, delete-orphan",
    )
    holidays: Mapped[List["StudentHoliday"]] = relationship(
        "StudentHoliday",
        cascade="all, delete-orphan",
    )
    calendar_setting: Mapped[Optional["StudentCalendarSetting"]] = relationship(
        "StudentCalendarSetting",
        uselist=False,
        cascade="all, delete-orphan",
    )


class FacultyProfile(Base):
    __tablename__ = "faculty_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    faculty_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)
    department: Mapped[str] = mapped_column(String(100), default="Computer Science and Engineering")
    designation: Mapped[str] = mapped_column(String(100), default="Faculty Advisor")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", back_populates="faculty_profile")
    departments: Mapped[List["Department"]] = relationship(
        "Department",
        secondary="faculty_departments",
        back_populates="faculty_profiles",
    )
