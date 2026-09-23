"""Authoritative simulation and prediction execution service.

Implements strict ML rules:
1. One authoritative simulation execution function: execute_student_simulation.
2. Reads dynamic model metadata from models/metrics.json.
3. Loads models and calculates deterministic ML prediction + TreeSHAP + Risk assessment.
4. Persists a single authoritative PredictionRecord.
5. Instrumented with a call counter get_ml_execution_count() to prove ML actually executes during simulation
   and NEVER during read-only page views (Results/TreeSHAP/Risk).
"""
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from backend.models.prediction import PredictionRecord
from backend.models.profile import StudentProfile
from src.predict import build_student_frame, predict_student

logger = logging.getLogger(__name__)

# Instrumentation for forensic testing of ML execution count
_ML_EXECUTION_COUNTER = 0

def get_ml_execution_count() -> int:
    global _ML_EXECUTION_COUNTER
    return _ML_EXECUTION_COUNTER

def reset_ml_execution_count() -> None:
    global _ML_EXECUTION_COUNTER
    _ML_EXECUTION_COUNTER = 0

def get_authoritative_model_metadata() -> Tuple[str, str]:
    """Read dynamic model names from model artifacts."""
    metrics_path = Path("models/metrics.json")
    if metrics_path.exists():
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                m = json.load(f)
            return (
                m.get("selected_regression_model", "Tuned Random Forest Regressor"),
                m.get("selected_classifier_model", "Tuned Random Forest Classifier")
            )
        except Exception as e:
            logger.warning(f"Failed to read model metrics.json: {e}")
    return ("Tuned Random Forest Regressor", "Tuned Random Forest Classifier")

def execute_student_simulation(
    profile: StudentProfile,
    db: Session,
    override_features: Optional[Dict[str, Any]] = None
) -> PredictionRecord:
    """Run exactly ONE authoritative ML simulation for a student and save the PredictionRecord."""
    global _ML_EXECUTION_COUNTER

    features = override_features or {}

    age = features.get("age") if features.get("age") is not None else profile.age
    gender = features.get("gender") if features.get("gender") is not None else profile.gender
    attendance = features.get("attendance") if features.get("attendance") is not None else profile.attendance
    study_hours = features.get("study_hours") if features.get("study_hours") is not None else profile.study_hours
    sleep_hours = features.get("sleep_hours") if features.get("sleep_hours") is not None else profile.sleep_hours
    assignments = features.get("assignments_completed") if features.get("assignments_completed") is not None else profile.assignments_completed
    previous_grade = features.get("previous_grade") if features.get("previous_grade") is not None else profile.previous_grade
    parent_edu = features.get("parent_education") if features.get("parent_education") is not None else profile.parent_education
    internet = features.get("internet_access") if features.get("internet_access") is not None else profile.internet_access
    income = features.get("family_income") if features.get("family_income") is not None else profile.family_income
    extra = features.get("extra_classes") if features.get("extra_classes") is not None else profile.extra_classes
    participation = features.get("participation") if features.get("participation") is not None else profile.participation

    # Fallback to sensible defaults for categorical features if fresh profile
    age = age or 20
    gender = gender or "Female"
    parent_edu = parent_edu or "Bachelor's"
    internet = internet or "yes"
    income = income or "medium"
    extra = extra or "no"

    student_frame = build_student_frame(
        age=int(age),
        gender=str(gender),
        attendance=float(attendance or 0.0),
        study_hours=float(study_hours or 0.0),
        sleep_hours=float(sleep_hours or 0.0),
        assignments_completed=float(assignments or 0.0),
        previous_grade=float(previous_grade or 0.0),
        parent_education=str(parent_edu),
        internet_access=str(internet),
        family_income=str(income),
        extra_classes=str(extra),
        participation=float(participation or 0.0),
    )

    # Increment counter and execute ML model
    _ML_EXECUTION_COUNTER += 1
    ml_result = predict_student(student_frame)

    input_snapshot = {
        "age": age,
        "gender": gender,
        "attendance": attendance,
        "study_hours": study_hours,
        "sleep_hours": sleep_hours,
        "assignments_completed": assignments,
        "previous_grade": previous_grade,
        "parent_education": parent_edu,
        "internet_access": internet,
        "family_income": income,
        "extra_classes": extra,
        "participation": participation,
    }

    record = PredictionRecord(
        student_id=profile.id,
        predicted_score=ml_result.predicted_score,
        pass_fail=ml_result.pass_fail,
        pass_probability=ml_result.pass_probability,
        confidence_score=ml_result.confidence_score,
        risk_level=ml_result.risk_level,
        risk_index=ml_result.risk_index,
        risk_description=ml_result.risk_description,
        base_value=ml_result.base_value,
        input_features=input_snapshot,
        shap_summary={
            "top_positive": ml_result.top_positive,
            "top_negative": ml_result.top_negative,
            "base_value": ml_result.base_value,
            "contributions": ml_result.contributions.to_dict(orient="records") if hasattr(ml_result.contributions, "to_dict") else [],
        },
        model_comparison=ml_result.model_comparison,
        is_stale=False,
        stale_reason=None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
