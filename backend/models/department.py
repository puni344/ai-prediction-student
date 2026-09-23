"""Department and FacultyDepartment database models."""
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class FacultyDepartment(Base):
    """Many-to-many association table between faculty profiles and departments."""
    __tablename__ = "faculty_departments"

    faculty_profile_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("faculty_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class Department(Base):
    """Centralized department catalogue model."""
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    student_profiles: Mapped[List["StudentProfile"]] = relationship(
        "StudentProfile",
        back_populates="department_rel",
    )
    faculty_profiles: Mapped[List["FacultyProfile"]] = relationship(
        "FacultyProfile",
        secondary="faculty_departments",
        back_populates="departments",
    )
