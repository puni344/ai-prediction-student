"""PredictionRecord and DailyPredictionSnapshot database models."""
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class PredictionRecord(Base):
    """Temporary / What-If simulation records."""
    __tablename__ = "prediction_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    predicted_score: Mapped[float] = mapped_column(Float, nullable=False)
    pass_fail: Mapped[str] = mapped_column(String(20), nullable=False)
    pass_probability: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_index: Mapped[float] = mapped_column(Float, nullable=False)
    risk_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    base_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    input_features: Mapped[dict] = mapped_column(JSON, default=dict)
    shap_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    model_comparison: Mapped[dict] = mapped_column(JSON, default=dict)

    # Cadence & staleness indicators
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False)
    stale_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped["StudentProfile"] = relationship("StudentProfile", back_populates="predictions")


class DailyPredictionSnapshot(Base):
    """Immutable official daily academic prediction snapshot.
    
    Exactly ONE snapshot per student per day at/after 09:00 AM Asia/Kolkata.
    Preserves historical record of student state at simulation time.
    """
    __tablename__ = "daily_prediction_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    snapshot_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    snapshot_time: Mapped[str] = mapped_column(String(8), default="09:00:00")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")

    # Inputs at simulation time
    study_hours: Mapped[float] = mapped_column(Float, nullable=False)
    attendance: Mapped[float] = mapped_column(Float, nullable=False)
    sleep_hours: Mapped[float] = mapped_column(Float, nullable=False)
    assignments_completed: Mapped[float] = mapped_column(Float, nullable=False)
    participation: Mapped[float] = mapped_column(Float, nullable=False)
    previous_grade: Mapped[float] = mapped_column(Float, nullable=False)

    # Official ML outputs
    predicted_score: Mapped[float] = mapped_column(Float, nullable=False)
    pass_probability: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_index: Mapped[float] = mapped_column(Float, nullable=False)
    risk_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    shap_data: Mapped[dict] = mapped_column(JSON, default=dict)
    recommendation_data: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    student: Mapped["StudentProfile"] = relationship("StudentProfile", back_populates="daily_snapshots")

    __table_args__ = (
        UniqueConstraint("student_id", "snapshot_date", name="uq_student_daily_snapshot_date"),
    )
