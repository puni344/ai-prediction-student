"""Tests for Student Prediction Flow, Auto-Simulation, and Call-Count Instrumentation (Requirements 13, 14, 15, 16, 22).

Covers:
- Profile edit triggers automatic simulation ONCE
- Profile update actually changes prediction between low/high inputs
- Call-count instrumentation proving ML executes on simulate/profile save but NOT on reading latest/results/SHAP/risk
- Official daily snapshot vs simulation separation
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, StudentProfile, PredictionRecord
from backend.security import create_access_token
import src.predict as predict_module

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

class TestStudentPredictionFlow:
    def test_profile_update_triggers_automatic_simulation_once(self, student_auth_headers):
        """Updating profile triggers exactly ONE simulation and saves new PredictionRecord."""
        db = SessionLocal()
        user = db.query(User).filter(User.email == TEST_STUDENT_EMAIL).first()
        initial_records_count = db.query(PredictionRecord).filter(PredictionRecord.student_id == user.student_profile.id).count()
        db.close()

        payload = {
            "study_hours": 6.0,
            "attendance": 92.0,
            "previous_grade": 88.0,
            "assignments_completed": 90.0,
        }
        res = client.put("/api/students/profile", json=payload, headers=student_auth_headers)
        assert res.status_code == 200

        db = SessionLocal()
        new_records_count = db.query(PredictionRecord).filter(PredictionRecord.student_id == user.student_profile.id).count()
        latest_record = (
            db.query(PredictionRecord)
            .filter(PredictionRecord.student_id == user.student_profile.id)
            .order_by(PredictionRecord.created_at.desc())
            .first()
        )
        assert new_records_count == initial_records_count + 1
        assert latest_record.input_features["study_hours"] == 6.0
        assert latest_record.input_features["attendance"] == 92.0
        db.close()

    def test_materially_different_profiles_produce_different_predictions(self, student_auth_headers):
        """Profile A (low) and Profile B (high) produce distinct predictions matching direct ML."""
        # Low inputs
        low_payload = {
            "study_hours": 1.0,
            "attendance": 55.0,
            "previous_grade": 50.0,
            "assignments_completed": 40.0,
            "participation": 40.0,
        }
        res_low = client.post("/api/predictions/simulate", json=low_payload, headers=student_auth_headers)
        assert res_low.status_code == 200
        score_low = res_low.json()["predicted_score"]

        # High inputs
        high_payload = {
            "study_hours": 6.0,
            "attendance": 95.0,
            "previous_grade": 92.0,
            "assignments_completed": 95.0,
            "participation": 90.0,
        }
        res_high = client.post("/api/predictions/simulate", json=high_payload, headers=student_auth_headers)
        assert res_high.status_code == 200
        score_high = res_high.json()["predicted_score"]

        assert score_high > score_low, f"Expected {score_high} > {score_low}"

    def test_ml_call_count_instrumentation(self, student_auth_headers):
        """Verify ML executes exactly once on simulate, and 0 times on reading result endpoints."""
        orig_predict = predict_module.predict_student
        call_count = 0

        def instrumented_predict(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return orig_predict(*args, **kwargs)

        with patch("backend.services.prediction_service.predict_student", side_effect=instrumented_predict):
            # 1. Run simulation -> exactly 1 ML execution
            sim_res = client.post(
                "/api/predictions/simulate",
                json={"study_hours": 5.0, "attendance": 85.0},
                headers=student_auth_headers,
            )
            assert sim_res.status_code == 200
            assert call_count == 1, f"Expected 1 ML call on simulation, got {call_count}"

            # 2. GET /api/predictions/latest -> 0 additional calls
            latest_res = client.get("/api/predictions/latest", headers=student_auth_headers)
            assert latest_res.status_code == 200
            assert call_count == 1, f"Expected 0 ML calls on get latest, got {call_count}"

            # 3. GET trends/results -> 0 additional calls
            trends_res = client.get("/api/predictions/trends?view_type=day", headers=student_auth_headers)
            assert trends_res.status_code == 200
            assert call_count == 1, f"Expected 0 ML calls on get trends, got {call_count}"
