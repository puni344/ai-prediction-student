from backend.services.prediction_service import execute_student_simulation, get_authoritative_model_metadata
"""Prediction simulation, official daily snapshots, and trend aggregation endpoints."""
import sys
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.prediction import PredictionRecord, DailyPredictionSnapshot
from backend.schemas.prediction import (
    PredictionSimulationRequest,
    PredictionResponse,
    DailySnapshotResponse,
    SnapshotTrendResponse,
)
from backend.security import require_role
from backend.services.snapshot_service import (
    get_or_create_daily_snapshot,
    get_student_snapshots,
    get_snapshot_trends,
)

# Ensure ML core src is accessible
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# WRAP EXISTING ML FUNCTIONS - ZERO DUPLICATION
from src.predict import build_student_frame, predict_student

def _get_model_metadata():
    metrics_file = PROJECT_ROOT / "models" / "metrics.json"
    perf_model = "Tuned Random Forest Regressor"
    class_model = "Tuned Random Forest Classifier"
    if metrics_file.exists():
        try:
            import json
            m_data = json.loads(metrics_file.read_text(encoding="utf-8"))
            perf_model = m_data.get("selected_regression_model", perf_model)
            class_model = m_data.get("selected_classifier_model", class_model)
        except Exception:
            pass
    return perf_model, class_model

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.get("/snapshot/today", response_model=Optional[DailySnapshotResponse])
def get_today_snapshot(
    force_allow_before_9: bool = Query(False, description="Admin/test flag to bypass 09:00 AM check"),
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve today's official immutable daily academic snapshot.

    Enforces:
    - Official simulation at 09:00 AM Asia/Kolkata.
    - If accessed after 09:00 AM and no snapshot exists, creates ONE immutable snapshot.
    - If accessed before 09:00 AM and no snapshot exists, returns null (not yet generated).
    - If snapshot already exists, returns it unchanged.
    """
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    snapshot = get_or_create_daily_snapshot(
        db=db,
        student_id=profile.id,
        force_allow_before_9=force_allow_before_9,
    )
    return snapshot


@router.get("/snapshots", response_model=List[DailySnapshotResponse])
def get_historical_snapshots(
    limit: int = Query(60, ge=1, le=365),
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve the student's historical daily snapshots in chronological order."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    return get_student_snapshots(db=db, student_id=profile.id, limit=limit)


@router.get("/trends", response_model=SnapshotTrendResponse)
def get_trends(
    view_type: str = Query("day", pattern="^(day|week|weekly|month|monthly|year|yearly|semester)$"),
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve aggregated snapshot trends across Weekly, Monthly, or Semester timeframes.

    Pure aggregation of historical daily snapshots — no fake ML models.
    """
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    return get_snapshot_trends(db=db, student_id=profile.id, view_type=view_type)


@router.post("/simulate", response_model=PredictionResponse)
def simulate_prediction(
    payload: PredictionSimulationRequest,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Run an interactive 'What-If Preview' simulation.

    Executes exactly ONE authoritative ML prediction and saves the authoritative PredictionRecord.
    Does NOT create an official daily snapshot.
    """
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    override_dict = payload.model_dump(exclude_unset=True)
    record = execute_student_simulation(profile, db, override_features=override_dict)

    perf_model, class_model = get_authoritative_model_metadata()
    shap_data = record.shap_summary or {}

    return PredictionResponse(
        id=record.id,
        predicted_score=record.predicted_score,
        pass_fail=record.pass_fail,
        pass_probability=record.pass_probability,
        confidence_score=record.confidence_score,
        risk_level=record.risk_level,
        risk_index=record.risk_index,
        risk_description=record.risk_description,
        base_value=record.base_value,
        shap_consistency=True,
        top_positive=shap_data.get("top_positive", []),
        top_negative=shap_data.get("top_negative", []),
        model_comparison=record.model_comparison,
        performance_model=perf_model,
        pass_fail_model=class_model,
        is_stale=record.is_stale,
        stale_reason=record.stale_reason,
        is_what_if_preview=True,
        created_at=record.created_at,
    )


@router.get("/latest", response_model=Optional[PredictionResponse])
def get_latest_prediction(
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve the single authoritative saved prediction result for the student.

    Zero ML inference is executed on this call. If no prediction has been executed, returns null.
    """
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    record = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.student_id == profile.id)
        .order_by(PredictionRecord.created_at.desc())
        .first()
    )
    if not record:
        return None

    perf_model, class_model = _get_model_metadata()
    shap_data = record.shap_summary or {}

    return PredictionResponse(
        id=record.id,
        predicted_score=record.predicted_score,
        pass_fail=record.pass_fail,
        pass_probability=record.pass_probability,
        confidence_score=record.confidence_score,
        risk_level=record.risk_level,
        risk_index=record.risk_index,
        risk_description=record.risk_description or "",
        base_value=record.base_value or 0.0,
        shap_consistency=True,
        top_positive=shap_data.get("top_positive", []),
        top_negative=shap_data.get("top_negative", []),
        model_comparison=record.model_comparison or {},
        performance_model=perf_model,
        pass_fail_model=class_model,
        is_stale=record.is_stale,
        stale_reason=record.stale_reason,
        is_what_if_preview=False,
        created_at=record.created_at,
    )


@router.get("/history", response_model=List[PredictionResponse])
def get_prediction_history(
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve the authenticated student's chronological prediction history."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.student_id == profile.id)
        .order_by(PredictionRecord.created_at.desc())
        .all()
    )

    history = []
    for r in records:
        shap_data = r.shap_summary or {}
        perf_model, class_model = _get_model_metadata()
        history.append(
            PredictionResponse(
                id=r.id,
                predicted_score=r.predicted_score,
                pass_fail=r.pass_fail,
                pass_probability=r.pass_probability,
                confidence_score=r.confidence_score,
                risk_level=r.risk_level,
                risk_index=r.risk_index,
                risk_description=r.risk_description or "",
                base_value=r.base_value or 0.0,
                shap_consistency=True,
                top_positive=shap_data.get("top_positive", []),
                top_negative=shap_data.get("top_negative", []),
                model_comparison=r.model_comparison or {},
                performance_model=perf_model,
                pass_fail_model=class_model,
                is_what_if_preview=True,
                created_at=r.created_at,
            )
        )
    return history
