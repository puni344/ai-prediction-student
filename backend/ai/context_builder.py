"""Builds minimized, academic-only context from verified student database records."""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models.user import User
from backend.models.profile import StudentProfile
from backend.models.prediction import PredictionRecord, DailyPredictionSnapshot


def build_student_ai_context(db: Session, current_user: User) -> Dict[str, Any]:
    """Assemble verified student academic context without any demographic/economic data.
    
    Zero PII, zero demographic/economic attributes (age, gender, income, parental education,
    internet access, extra classes) are passed.
    """
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise ValueError("Student profile not found. Complete your profile before requesting AI advice.")

    # Prioritize official DailyPredictionSnapshot, fallback to PredictionRecord
    latest_snapshot = (
        db.query(DailyPredictionSnapshot)
        .filter(DailyPredictionSnapshot.student_id == profile.id)
        .order_by(DailyPredictionSnapshot.snapshot_date.desc(), DailyPredictionSnapshot.created_at.desc())
        .first()
    )

    latest_pred = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.student_id == profile.id)
        .order_by(PredictionRecord.created_at.desc())
        .first()
    )

    # Minimized Academic Metrics ONLY
    academic_metrics = {
        "attendance": profile.attendance,
        "study_hours": profile.study_hours,
        "sleep_hours": profile.sleep_hours,
        "assignments_completed": profile.assignments_completed,
        "previous_grade": profile.previous_grade,
        "participation": profile.participation,
    }

    # Verified ML Prediction Outputs (Backend Authoritative)
    verified_predictions = None
    top_shap_factors = []
    risk_index = 25.0
    rec_data = None

    if latest_snapshot:
        verified_predictions = {
            "predicted_score": latest_snapshot.predicted_score,
            "pass_probability": latest_snapshot.pass_probability,
            "risk_level": latest_snapshot.risk_level,
            "risk_index": latest_snapshot.risk_index,
            "pass_fail": "Pass" if latest_snapshot.predicted_score >= 50.0 else "Fail",
        }
        risk_index = latest_snapshot.risk_index or 25.0
        rec_data = latest_snapshot.recommendation_data
        shap_data = latest_snapshot.shap_data or {}
        if isinstance(shap_data, dict):
            pos = shap_data.get("main_positive_factors", [])
            neg = shap_data.get("main_negative_factors", [])
            for item in pos[:3]:
                top_shap_factors.append({
                    "feature": item.get("technical_feature") or item.get("factor"),
                    "factor": item.get("factor"),
                    "contribution": item.get("impact", 0.0),
                    "direction": "positive",
                })
            for item in neg[:3]:
                top_shap_factors.append({
                    "feature": item.get("technical_feature") or item.get("factor"),
                    "factor": item.get("factor"),
                    "contribution": item.get("impact", 0.0),
                    "direction": "negative",
                })
    elif latest_pred:
        verified_predictions = {
            "predicted_score": latest_pred.predicted_score,
            "pass_probability": latest_pred.pass_probability,
            "risk_level": latest_pred.risk_level,
            "risk_index": latest_pred.risk_index,
            "pass_fail": latest_pred.pass_fail,
        }
        risk_index = latest_pred.risk_index or 25.0
        shap_summary = latest_pred.shap_summary or {}
        if isinstance(shap_summary, dict):
            top_pos = shap_summary.get("top_positive", [])
            top_neg = shap_summary.get("top_negative", [])
            top_shap_factors = top_pos[:3] + top_neg[:3]

    history_count = db.query(DailyPredictionSnapshot).filter(DailyPredictionSnapshot.student_id == profile.id).count()
    if history_count == 0:
        history_count = db.query(PredictionRecord).filter(PredictionRecord.student_id == profile.id).count()

    return {
        "student_name": current_user.full_name,
        "academic_metrics": academic_metrics,
        "verified_predictions": verified_predictions,
        "top_shap_factors": top_shap_factors,
        "risk_index": risk_index,
        "recommendation_data": rec_data,
        "history_count": history_count,
    }
