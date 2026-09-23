"""Tests for Student ML Model Provenance, Dynamics, and Parity (Requirements 18, 19, 20).

Covers:
- Inspect actual loaded models from disk: models/regression.pkl and models/classifier.pkl
- Verify exact model types and parameters inside sklearn pipelines
- Verify model metadata dynamically loaded from models/metrics.json
- Direct model execution vs API simulation vs saved PredictionRecord parity
"""
import json
from pathlib import Path
import joblib
import pytest
from fastapi.testclient import TestClient
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.pipeline import Pipeline

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, StudentProfile, PredictionRecord
from backend.security import create_access_token
from backend.services.prediction_service import get_authoritative_model_metadata
from src.predict import build_student_frame, predict_student

client = TestClient(app)
TEST_STUDENT_EMAIL = "test_forensic_student@institution.edu"

@pytest.fixture(scope="module")
def student_auth_headers():
    db = SessionLocal()
    user = db.query(User).filter(User.email == TEST_STUDENT_EMAIL).first()
    if not user:
        user = User(
            email=TEST_STUDENT_EMAIL,
            full_name="Forensic Test Student",
            role="student",
            hashed_password="mock-password",
            is_active=True,
            is_email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.is_active = True
        user.is_email_verified = True
        db.commit()

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if not profile:
        profile = StudentProfile(
            user_id=user.id,
            roll_number="FOR-STUDENT-001",
            department="Computer Science",
            academic_year="3rd Year",
            program="B.Tech",
            age=20,
            gender="Female",
            attendance=85.0,
            study_hours=4.0,
            sleep_hours=8.0,
            assignments_completed=80.0,
            previous_grade=78.0,
            participation=80.0,
        )
        db.add(profile)
        db.commit()
    db.close()

    token = create_access_token(data={"sub": TEST_STUDENT_EMAIL, "role": "student"})
    return {"Authorization": f"Bearer {token}"}

class TestModelProvenanceAndParity:
    def test_verify_actual_runtime_model_types_and_hyperparameters(self):
        """Verify actual disk artifacts without trusting filenames alone."""
        reg_path = Path("models/regression.pkl")
        clf_path = Path("models/classifier.pkl")
        assert reg_path.exists(), "Regression model artifact missing"
        assert clf_path.exists(), "Classifier model artifact missing"

        reg_pipeline = joblib.load(reg_path)
        clf_pipeline = joblib.load(clf_path)

        assert isinstance(reg_pipeline, Pipeline), f"Expected Pipeline, got {type(reg_pipeline)}"
        assert isinstance(clf_pipeline, Pipeline), f"Expected Pipeline, got {type(clf_pipeline)}"

        reg_model = reg_pipeline.named_steps["model"]
        clf_model = clf_pipeline.named_steps["model"]

        assert isinstance(reg_model, RandomForestRegressor), f"Expected RandomForestRegressor, got {type(reg_model)}"
        assert reg_model.n_estimators == 250, f"Expected 250 estimators, got {reg_model.n_estimators}"

        assert isinstance(clf_model, RandomForestClassifier), f"Expected RandomForestClassifier, got {type(clf_model)}"
        assert clf_model.n_estimators == 400, f"Expected 400 estimators, got {clf_model.n_estimators}"

    def test_verify_dynamic_model_metadata_from_metrics(self):
        """Verify model metadata originates dynamically from models/metrics.json."""
        perf_name, class_name = get_authoritative_model_metadata()
        with open("models/metrics.json", "r", encoding="utf-8") as f:
            metrics = json.load(f)
        assert perf_name == metrics.get("selected_regression_model")
        assert class_name == metrics.get("selected_classifier_model")
        assert "Random Forest" in perf_name
        assert "Random Forest" in class_name

    def test_direct_model_vs_api_vs_saved_record_parity(self, student_auth_headers):
        """Verify direct model execution == API simulation == saved PredictionRecord == latest API."""
        input_data = {
            "age": 21,
            "gender": "Female",
            "attendance": 88.0,
            "study_hours": 5.0,
            "sleep_hours": 8.0,
            "assignments_completed": 85.0,
            "previous_grade": 82.0,
            "parent_education": "Bachelor's",
            "internet_access": "yes",
            "family_income": "medium",
            "extra_classes": "no",
            "participation": 80.0,
        }
        student_frame = build_student_frame(**input_data)
        direct_result = predict_student(student_frame)

        res = client.post("/api/predictions/simulate", json=input_data, headers=student_auth_headers)
        assert res.status_code == 200, f"Simulate failed: {res.text}"
        api_data = res.json()

        assert abs(direct_result.predicted_score - api_data["predicted_score"]) < 1e-4
        assert direct_result.pass_fail == api_data["pass_fail"]
        assert abs(direct_result.pass_probability - api_data["pass_probability"]) < 1e-4

        db = SessionLocal()
        record = db.query(PredictionRecord).filter(PredictionRecord.id == api_data["id"]).first()
        assert record is not None
        assert abs(record.predicted_score - direct_result.predicted_score) < 1e-4
        assert record.pass_fail == direct_result.pass_fail
        db.close()

        latest_res = client.get("/api/predictions/latest", headers=student_auth_headers)
        assert latest_res.status_code == 200
        latest_data = latest_res.json()
        assert latest_data["id"] == api_data["id"]
        assert abs(latest_data["predicted_score"] - direct_result.predicted_score) < 1e-4
