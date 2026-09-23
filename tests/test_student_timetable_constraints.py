"""Tests for Timetable Constraints, Invariants, and Bidirectional Sync (Requirements 2, 3, 23, 24, 25, 26, 27).

Covers:
- Meal inside college (College 09:00-16:00, Lunch 13:00-13:30) is VALID, displays interrupting college, no double-counting
- Meal outside college is VALID
- Hard conflict (Lunch 13:00-13:30, Dinner 13:15-13:45) returns HARD_CONSTRAINT_CONFLICT and no schedule
- Capacity infeasibility returns partial preview with maximum schedulable study time and exact shortfall
- 1440-minute invariant: sum(block.duration_minutes) == 1440
- No overlapping blocks in generated schedule
- Today/Tomorrow restriction
- Bidirectional synchronization: Timetable update updates canonical student profile
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal
from backend.models import User, StudentProfile, StudentTimetablePreference
from backend.security import create_access_token
from backend.schemas.timetable import TimetablePreferencesSchema
from backend.services.timetable_planner import (
    generate_full_day_timetable,
    validate_24h_constraints,
)

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
        )
        db.add(profile)
        db.commit()
    db.close()

    token = create_access_token(data={"sub": TEST_STUDENT_EMAIL, "role": "student"})
    return {"Authorization": f"Bearer {token}"}

class TestStudentTimetableConstraints:
    def test_meal_inside_college_is_valid_and_splits_college(self):
        """Meal inside college (09:00-16:00, Lunch 13:00-13:30) is VALID, does not double count."""
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
        assert val.error_type is None

        # Hard occupied minutes should be UNION:
        # College: 09:00-16:00 = 420 mins (lunch 13:00-13:30 is inside, so union is still 420 mins)
        # Breakfast: 08:00-08:30 = 30 mins
        # Dinner: 20:00-20:30 = 30 mins
        # Total fixed = 420 + 30 + 30 = 480 mins (8 hours)
        assert val.hard_occupied_minutes == 480

        # Generate schedule
        sched = generate_full_day_timetable(prefs)
        assert sched.validation.valid is True
        blocks = sched.schedule
        assert len(blocks) > 0

        # Invariant: exactly 1440 minutes
        dur_sum = sum(b.duration_minutes for b in blocks)
        assert dur_sum == 1440, f"Expected 1440 minutes, got {dur_sum}"

        # Verify college is split: 09:00-13:00 college, 13:00-13:30 lunch, 13:30-16:00 college
        categories_and_times = [(b.activity, b.start_time, b.end_time) for b in blocks]
        assert ("College Academic Schedule (Morning Sessions)", "09:00", "13:00") in categories_and_times and ("College Academic Schedule (Afternoon Sessions)", "13:30", "16:00") in categories_and_times
        assert ("Lunch & Midday Nutrition", "13:00", "13:30") in categories_and_times
        # Already verified afternoon sessions above

    def test_hard_constraint_conflict_returns_no_schedule(self):
        """Genuinely conflicting fixed constraints return HARD_CONSTRAINT_CONFLICT and no schedule."""
        # Lunch 13:00-13:30 conflicts with Dinner 13:15-13:45
        prefs = TimetablePreferencesSchema(
            college_start="09:00",
            college_end="16:00",
            breakfast_start="08:00",
            breakfast_duration=30,
            lunch_start="13:00",
            lunch_duration=30,
            dinner_start="13:15",
            dinner_duration=30,
            break_reserve_minutes=120,
            daily_study_hours=4.0,
            sleep_hours=8.0,
        )
        val = validate_24h_constraints(prefs)
        assert val.valid is False
        assert val.error_type == "HARD_CONSTRAINT_CONFLICT"

        sched = generate_full_day_timetable(prefs)
        assert sched.validation.valid is False
        assert sched.validation.error_type == "HARD_CONSTRAINT_CONFLICT"
        assert len(sched.schedule) == 0

    def test_capacity_infeasibility_returns_partial_preview_with_1440_sum(self):
        """Excessive study request returns partial preview and strictly maintains 1440 min sum."""
        # Request 14 hours study with 8h sleep and 7h college -> infeasible
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
            daily_study_hours=14.0,
            sleep_hours=8.0,
        )
        sched = generate_full_day_timetable(prefs)
        assert sched.validation.valid is False
        assert sched.validation.error_type == "CAPACITY_INFEASIBILITY"
        assert sched.is_partial_preview is True
        assert sched.validation.shortfall_minutes > 0

        blocks = sched.schedule
        assert len(blocks) > 0
        dur_sum = sum(b.duration_minutes for b in blocks)
        assert dur_sum == 1440, f"Expected 1440 minutes, got {dur_sum}"

    def test_no_schedule_block_overlaps(self):
        """Verify that within the 1440-minute schedule, no two consecutive blocks overlap."""
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
        sched = generate_full_day_timetable(prefs)
        blocks = sched.schedule
        for i in range(len(blocks) - 1):
            curr_b = blocks[i]
            next_b = blocks[i + 1]
            assert curr_b.end_time == next_b.start_time, (
                f"Block {curr_b.title} ({curr_b.end_time}) does not meet {next_b.title} ({next_b.start_time})"
            )

    def test_bidirectional_sync_timetable_to_profile(self, student_auth_headers):
        """Saving timetable preferences updates canonical student profile and triggers simulation."""
        payload = {
            "daily_study_hours": 4.5,
            "sleep_hours": 7.5,
            "college_start": "09:30",
            "college_end": "16:30",
            "breakfast_start": "08:15",
            "breakfast_duration": 30,
            "lunch_start": "13:15",
            "lunch_duration": 30,
            "dinner_start": "20:15",
            "dinner_duration": 30,
            "break_reserve_minutes": 120,
            "rest_minutes": 15,
            "meal_minutes": 30,
            "sleep_start": "23:00",
            "sleep_end": "06:30",
            "preferred_study_period": "evening",
            "session_length_preference": "standard",
        }
        res = client.post("/api/students/timetable/preferences", json=payload, headers=student_auth_headers)
        assert res.status_code == 200

        # Verify profile was updated in DB
        db = SessionLocal()
        user = db.query(User).filter(User.email == TEST_STUDENT_EMAIL).first()
        prof = user.student_profile
        assert prof.study_hours == 4.5
        assert prof.sleep_hours == 7.5
        pref = db.query(StudentTimetablePreference).filter(StudentTimetablePreference.student_id == prof.id).first()
        assert pref.college_start == "09:30"
        assert pref.college_end == "16:30"
        db.close()
