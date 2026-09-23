"""Tests for Student Profile Constraints and Routine Validation (Requirement 30).

Covers:
- Onboarding save
- Profile persistence
- Invalid profile rejection (attendance > 100, negative values, study > max)
- Dynamically calculated study and sleep maximums
- 24h validation
- Meal duration validation
- College timing validation
- Bidirectional synchronization with timetable preferences
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User, StudentProfile
from backend.models.timetable import StudentTimetablePreference
from backend.security import create_access_token
from backend.schemas.timetable import TimetablePreferencesSchema
from backend.services.timetable_planner import validate_24h_constraints

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
            hashed_password="mock-hashed-password",
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
            parent_education="Bachelor's",
            internet_access="yes",
            family_income="medium",
            extra_classes="no",
            participation=80.0,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    db.close()

    token = create_access_token(data={"sub": TEST_STUDENT_EMAIL, "role": "student"})
    return {"Authorization": f"Bearer {token}"}


class TestStudentProfileConstraints:
    def test_dynamic_allowable_sleep_and_study_ranges(self):
        """Verify allowable sleep/study limits are calculated dynamically based on routine."""
        # 7h college (09:00-16:00), 1.5h meals, 2h break
        prefs = TimetablePreferencesSchema(
            college_start="09:00",
            college_end="16:00",
            breakfast_start="08:00",
            breakfast_duration=30,
            lunch_start="13:00",
            lunch_duration=30,
            dinner_start="20:00",
            dinner_duration=30,
            break_reserve_minutes=120,
            daily_study_hours=4.0,
            sleep_hours=8.0,
        )
        val = validate_24h_constraints(prefs)
        assert val.valid is True
        assert val.min_allowable_sleep_hours == 6.0
        assert val.max_allowable_sleep_hours >= 8.0
        assert val.min_allowable_study_hours == 1.0
        assert val.max_allowable_study_hours >= 4.0

    def test_onboarding_and_profile_persistence(self, student_auth_headers):
        """Student can successfully save academic identity and complete daily routine."""
        payload = {
            "program": "B.Tech",
            "department": "Computer Science",
            "academic_year": "3rd Year",
            "college_start": "09:00",
            "college_end": "16:00",
            "breakfast_start": "08:00",
            "breakfast_duration": 30,
            "lunch_start": "13:00",
            "lunch_duration": 30,
            "dinner_start": "20:00",
            "dinner_duration": 30,
            "break_reserve_minutes": 120,
            "attendance": 88.0,
            "study_hours": 5.0,
            "sleep_hours": 8.0,
            "assignments_completed": 85.0,
            "previous_grade": 82.0,
            "participation": 80.0,
            "age": 21,
            "gender": "Female",
        }
        res = client.put("/api/students/profile", json=payload, headers=student_auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["study_hours"] == 5.0
        assert data["sleep_hours"] == 8.0
        assert data["college_start"] == "09:00"
        assert data["college_end"] == "16:00"
        assert data["breakfast_start"] == "08:00"
        assert data["lunch_start"] == "13:00"
        assert data["dinner_start"] == "20:00"

        # Verify database persistence in StudentTimetablePreference
        db = SessionLocal()
        user = db.query(User).filter(User.email == TEST_STUDENT_EMAIL).first()
        pref = db.query(StudentTimetablePreference).filter(StudentTimetablePreference.student_id == user.student_profile.id).first()
        assert pref is not None
        assert pref.daily_study_hours == 5.0
        assert pref.sleep_hours == 8.0
        assert pref.college_start == "09:00"
        assert pref.college_end == "16:00"
        assert pref.breakfast_start == "08:00"
        assert pref.lunch_start == "13:00"
        assert pref.dinner_start == "20:00"
        assert pref.break_reserve_minutes == 120
        db.close()

    def test_invalid_abnormal_profile_values_rejected(self, student_auth_headers):
        """Abnormal values (attendance > 100, study > 16, negative values) must be rejected."""
        # Attendance > 100
        res = client.put("/api/students/profile", json={"attendance": 150.0}, headers=student_auth_headers)
        assert res.status_code in [400, 422]

        # Assignments > 100
        res = client.put("/api/students/profile", json={"assignments_completed": 11111.0}, headers=student_auth_headers)
        assert res.status_code in [400, 422]

        # Negative previous grade
        res = client.put("/api/students/profile", json={"previous_grade": -10.0}, headers=student_auth_headers)
        assert res.status_code in [400, 422]

        # Excessive study hours
        res = client.put("/api/students/profile", json={"study_hours": 24.0}, headers=student_auth_headers)
        assert res.status_code in [400, 422]

    def test_24h_capacity_validation_failure_rejected(self, student_auth_headers):
        """Requested combination that exceeds 24-hour physical capacity must block save."""
        # 12h study + 12h sleep + 7h college = 31h (impossible)
        payload = {
            "study_hours": 12.0,
            "sleep_hours": 12.0,
            "college_start": "09:00",
            "college_end": "16:00",
        }
        res = client.put("/api/students/profile", json=payload, headers=student_auth_headers)
        assert res.status_code in [400, 422]
        assert "capacity" in res.text.lower() or "exceeds" in res.text.lower()

    def test_meal_duration_validation(self, student_auth_headers):
        """Meal duration outside allowable limits must be rejected."""
        # Breakfast duration 500 mins
        res = client.put("/api/students/profile", json={"breakfast_duration": 500}, headers=student_auth_headers)
        assert res.status_code in [400, 422]

    def test_college_timing_validation(self, student_auth_headers):
        """Invalid college timing (start == end) must be rejected."""
        res = client.put("/api/students/profile", json={"college_start": "09:00", "college_end": "09:00"}, headers=student_auth_headers)
        assert res.status_code in [400, 422]
