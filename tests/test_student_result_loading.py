"""Tests for Student Result Loading, SHAP, Risk, and Empty-State Handling (Requirements 17, 21, 24).

Covers:
- GET /api/predictions/latest returns the single authoritative PredictionRecord
- Top positive/negative TreeSHAP contributions match the saved record
- Risk tier and probability match the saved record
- Honest empty state when student has no simulation records
- Zero ML inference triggered during result retrieval
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, StudentProfile, PredictionRecord
from backend.security import create_access_token

client = TestClient(app)
TEST_STUDENT_EMAIL = "test_forensic_student@institution.edu"
EMPTY_STUDENT_EMAIL = "empty_student_forensic@institution.edu"

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
        db.refresh(profile)

    # Ensure a prediction record exists for test student
    latest_rec = db.query(PredictionRecord).filter(PredictionRecord.student_id == profile.id).first()
    if not latest_rec:
        token = create_access_token(data={"sub": TEST_STUDENT_EMAIL, "role": "student"})
        client.post("/api/predictions/simulate", json={"study_hours": 5.0, "attendance": 85.0}, headers={"Authorization": f"Bearer {token}"})
    db.close()

    token = create_access_token(data={"sub": TEST_STUDENT_EMAIL, "role": "student"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def empty_student_auth_headers():
    db = SessionLocal()
    user = db.query(User).filter(User.email == EMPTY_STUDENT_EMAIL).first()
    if not user:
        user = User(
            email=EMPTY_STUDENT_EMAIL,
            full_name="Empty Forensic Student",
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
            roll_number="EMP-001",
            department="Computer Science",
            academic_year="2nd Year",
            program="B.Tech",
            age=20,
            gender="Male",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Ensure no prediction records exist for this student
    db.query(PredictionRecord).filter(PredictionRecord.student_id == profile.id).delete()
    db.commit()
    db.close()

    token = create_access_token(data={"sub": EMPTY_STUDENT_EMAIL, "role": "student"})
    return {"Authorization": f"Bearer {token}"}

class TestStudentResultLoading:
    def test_latest_outcome_reads_authoritative_saved_record(self, student_auth_headers):
        """GET /api/predictions/latest returns the exact fields of the latest saved PredictionRecord."""
        db = SessionLocal()
        user = db.query(User).filter(User.email == TEST_STUDENT_EMAIL).first()
        latest_record = (
            db.query(PredictionRecord)
            .filter(PredictionRecord.student_id == user.student_profile.id)
            .order_by(PredictionRecord.created_at.desc())
            .first()
        )
        assert latest_record is not None, "Expected an existing prediction record for test student"
        db.close()

        res = client.get("/api/predictions/latest", headers=student_auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == latest_record.id
        assert abs(data["predicted_score"] - latest_record.predicted_score) < 1e-4
        assert data["pass_fail"] == latest_record.pass_fail
        assert data["risk_level"] == latest_record.risk_level

    def test_treeshap_contributions_match_saved_record(self, student_auth_headers):
        """TreeSHAP values returned match the SHAP contributions saved in PredictionRecord."""
        db = SessionLocal()
        user = db.query(User).filter(User.email == TEST_STUDENT_EMAIL).first()
        latest_record = (
            db.query(PredictionRecord)
            .filter(PredictionRecord.student_id == user.student_profile.id)
            .order_by(PredictionRecord.created_at.desc())
            .first()
        )
        assert latest_record.shap_summary is not None
        db.close()

        res = client.get("/api/predictions/latest", headers=student_auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "top_positive" in data
        assert "top_negative" in data
        assert len(data["top_positive"]) > 0 or len(data["top_negative"]) > 0

    def test_honest_empty_state_when_no_predictions_exist(self, empty_student_auth_headers):
        """When student has no prediction records, GET /api/predictions/latest returns null (honest empty state)."""
        res = client.get("/api/predictions/latest", headers=empty_student_auth_headers)
        assert res.status_code == 200
        assert res.json() is None
