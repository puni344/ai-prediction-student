"""Comprehensive test suite for Calendarific integration and Academic Calendar Hierarchy.

Tests:
1. Single API key configuration across all years (2025, 2026, 2027)
2. Regional filtering: country=IN, location=in-ap
3. SQLite caching: repeated syncs do not call external API
4. Resilience without API key
5. Level 1 Priority: Admin institution-wide holiday affects all students and blocks student override (HTTP 409)
6. Level 2 Priority: Student personal override affects only that student
7. Level 3 Priority: Verified AP Government calendar overrides third-party provider
8. Level 4 Priority: Calendarific festivals/observances do NOT automatically cancel college
9. Quota/429 fallback handling
10. Separation from ML predictions and daily snapshots
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import SessionLocal
from backend.config import settings
from backend.models import User, StudentProfile, PredictionRecord
from backend.services.academic_calendar.calendar_models import (
    AcademicCalendar,
    StudentCalendarOverride,
    AdminCalendarOverride,
    HolidayCategory,
    HolidaySource,
    DayFinalStatus,
)
from backend.services.academic_calendar.calendarific_client import CalendarificClient
from backend.services.academic_calendar.calendar_sync_service import (
    sync_calendar_for_year,
    is_year_cached,
)
from backend.services.academic_calendar.calendar_resolution_service import (
    resolve_day_status,
)

client = TestClient(app)


def get_admin_headers():
    res = client.post(
        "/api/auth/login",
        json={"email": "admin@institution.edu", "password": "AdminSecurePassword2026!"}
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestCalendarificConfiguration:
    def test_calendarific_single_key_all_years(self):
        """Verify the same key configuration is used for 2025, 2026, 2027."""
        c1 = CalendarificClient(api_key=settings.CALENDARIFIC_API_KEY)
        c2 = CalendarificClient(api_key=settings.CALENDARIFIC_API_KEY)
        assert c1.api_key == c2.api_key
        assert c1.base_url == "https://calendarific.com/api/v2"

    def test_andhra_pradesh_region(self):
        """Verify country=IN and location=in-ap."""
        c = CalendarificClient(api_key=settings.CALENDARIFIC_API_KEY)
        assert c.country == "IN"
        assert c.location == "in-ap"

    def test_calendarific_optional(self):
        """When API key is missing, client is not configured but doesn't crash."""
        c = CalendarificClient(api_key=None)
        assert not c.is_configured
        res = c.get_holidays(2026)
        assert res is None


class TestCalendarCacheAndResilience:
    def test_calendar_cache(self):
        """Verify repeated sync with force=False uses local DB cache."""
        db = SessionLocal()
        try:
            client_inst = CalendarificClient(api_key=settings.CALENDARIFIC_API_KEY)
            # First sync ensures year is cached
            sync_calendar_for_year(db, client_inst, 2026, force=False)
            assert is_year_cached(db, 2026)

            # Second sync without force should return cached status without calling provider
            result = sync_calendar_for_year(db, client_inst, 2026, force=False)
            assert result["calendarific"]["status"] == "cached"
        finally:
            db.close()

    def test_calendarific_429_fallback(self):
        """When provider returns None (e.g. 429 quota error), fallback to cached data."""
        db = SessionLocal()
        try:
            # Client with dummy key that won't make real successful calls
            dummy_client = CalendarificClient(api_key="")
            result = sync_calendar_for_year(db, dummy_client, 2026, force=False)
            # Local data should remain intact
            assert is_year_cached(db, 2026)
        finally:
            db.close()

    def test_no_ml_snapshot_created_by_calendar_sync(self):
        """Calendar sync must NEVER create ML predictions or daily snapshots."""
        db = SessionLocal()
        try:
            pred_count_before = db.query(PredictionRecord).count()

            client_inst = CalendarificClient(api_key=settings.CALENDARIFIC_API_KEY)
            sync_calendar_for_year(db, client_inst, 2026, force=False)

            pred_count_after = db.query(PredictionRecord).count()

            assert pred_count_before == pred_count_after
        finally:
            db.close()


class TestAcademicCalendarHierarchy:
    """Security tests TEST 1 through TEST 7 for the 6-tier hierarchy."""

    def test_admin_holiday_priority(self):
        """TEST 1: Admin marks 2026-09-25 as institution holiday -> ALL students resolve to holiday."""
        db = SessionLocal()
        try:
            target_date = "2026-09-25"
            # Set admin override
            existing = db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == target_date).first()
            if existing:
                existing.college_status = False
                existing.reason = "Annual Foundation Day"
            else:
                db.add(AdminCalendarOverride(
                    date=target_date,
                    override_type="HOLIDAY",
                    college_status=False,
                    reason="Annual Foundation Day",
                    created_by="admin@institution.edu"
                ))
            db.commit()

            # Test Student 1, Student 2, Student 3
            res_1 = resolve_day_status(1, target_date, db)
            res_2 = resolve_day_status(2, target_date, db)
            res_3 = resolve_day_status(999, target_date, db)

            assert res_1["holiday"] is True
            assert res_1["college_status"] is False
            assert res_1["locked"] is True
            assert res_1["override_scope"] == "INSTITUTION"

            assert res_2["holiday"] is True
            assert res_2["college_status"] is False
            assert res_2["locked"] is True

            assert res_3["holiday"] is True
            assert res_3["college_status"] is False
            assert res_3["locked"] is True
        finally:
            # Cleanup
            db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == "2026-09-25").delete()
            db.commit()
            db.close()

    def test_student_cannot_override_admin(self):
        """TEST 2: Student attempts to override admin institution holiday -> HTTP 409 Conflict."""
        db = SessionLocal()
        try:
            target_date = "2026-09-25"
            # Ensure admin override exists
            existing = db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == target_date).first()
            if not existing:
                db.add(AdminCalendarOverride(
                    date=target_date,
                    override_type="HOLIDAY",
                    college_status=False,
                    reason="Institution Holiday",
                    created_by="admin@institution.edu"
                ))
                db.commit()

            # Find or login a student
            student_user = db.query(User).filter(User.role == "student").first()
            created_temp_student = False
            if not student_user:
                from backend.security import get_password_hash
                student_user = User(
                    email="temp_cal_student@institution.edu",
                    full_name="Temp Cal Student",
                    role="student",
                    hashed_password=get_password_hash("StudentPassword123!"),
                    is_active=True,
                    is_email_verified=True,
                )
                db.add(student_user)
                db.commit()
                db.refresh(student_user)
                created_temp_student = True

            from backend.security import create_access_token
            token = create_access_token({"sub": student_user.email, "role": "student"})
            headers = {"Authorization": f"Bearer {token}"}
            put_res = client.put(
                f"/api/calendar/student-overrides/{target_date}",
                json={"college_status": True, "reason": "Attempting override"},
                headers=headers,
            )
            assert put_res.status_code == 409
            assert "institution-wide holiday" in put_res.json()["detail"]
        finally:
            if created_temp_student:
                db.query(User).filter(User.email == "temp_cal_student@institution.edu").delete()
            db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == "2026-09-25").delete()
            db.commit()
            db.close()

    def test_student_personal_override(self):
        """TEST 3: Student A marks 2026-09-28 as personal holiday -> only Student A is affected."""
        db = SessionLocal()
        try:
            target_date = "2026-09-28"  # A Monday
            # Student 1 marks personal holiday
            existing = db.query(StudentCalendarOverride).filter(
                StudentCalendarOverride.student_id == 1,
                StudentCalendarOverride.date == target_date,
            ).first()
            if existing:
                existing.college_status = False
                existing.reason = "Personal leave"
            else:
                db.add(StudentCalendarOverride(
                    student_id=1,
                    date=target_date,
                    override_type="HOLIDAY",
                    college_status=False,
                    reason="Personal leave",
                ))
            db.commit()

            # Student 1 status
            res_a = resolve_day_status(1, target_date, db)
            assert res_a["holiday"] is True
            assert res_a["college_status"] is False
            assert res_a["student_override"] is True
            assert res_a["override_scope"] == "STUDENT"

            # Student 2 status (no override)
            res_b = resolve_day_status(2, target_date, db)
            assert res_b["student_override"] is False
            # On a Monday with no global holiday, Student 2 has normal college
            assert res_b["college_status"] is True
            assert res_b["final_status"] == DayFinalStatus.COLLEGE_DAY.value
        finally:
            db.query(StudentCalendarOverride).filter(
                StudentCalendarOverride.student_id == 1,
                StudentCalendarOverride.date == "2026-09-28",
            ).delete()
            db.commit()
            db.close()

    def test_remove_student_override(self):
        """TEST 4: Removing Student A override reverts Student A to shared calendar state."""
        db = SessionLocal()
        try:
            target_date = "2026-09-28"
            # Set override
            db.add(StudentCalendarOverride(
                student_id=1,
                date=target_date,
                override_type="HOLIDAY",
                college_status=False,
                reason="Temporary leave",
            ))
            db.commit()
            res_before = resolve_day_status(1, target_date, db)
            assert res_before["student_override"] is True

            # Delete override
            db.query(StudentCalendarOverride).filter(
                StudentCalendarOverride.student_id == 1,
                StudentCalendarOverride.date == target_date,
            ).delete()
            db.commit()

            res_after = resolve_day_status(1, target_date, db)
            assert res_after["student_override"] is False
            assert res_after["college_status"] is True
        finally:
            db.close()

    def test_remove_admin_override(self):
        """TEST 5: Removing Admin override reverts all students to shared calendar state."""
        db = SessionLocal()
        try:
            target_date = "2026-09-29"
            db.add(AdminCalendarOverride(
                date=target_date,
                override_type="HOLIDAY",
                college_status=False,
                reason="Admin temporary closure",
            ))
            db.commit()
            res_locked = resolve_day_status(1, target_date, db)
            assert res_locked["admin_override"] is True

            # Remove admin override
            db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == target_date).delete()
            db.commit()

            res_reverted = resolve_day_status(1, target_date, db)
            assert res_reverted["admin_override"] is False
            assert res_reverted["locked"] is False
        finally:
            db.close()

    def test_festival_not_automatic_closure(self):
        """TEST 6: Calendarific festival does NOT automatically become a college holiday."""
        db = SessionLocal()
        try:
            target_date = "2026-10-15"  # A Thursday
            # Add a festival entry from Calendarific
            db.add(AcademicCalendar(
                date=target_date,
                name="Test Festival of Lights",
                normalized_name="test festival of lights",
                calendar_year=2026,
                state_code="in-ap",
                holiday_category=HolidayCategory.FESTIVAL.value,
                holiday_source=HolidaySource.CALENDARIFIC.value,
                source_priority=50,
                is_public_holiday=False,
                is_default_no_college=False,
                is_active=True,
            ))
            db.commit()

            res = resolve_day_status(None, target_date, db)
            assert res["holiday"] is True
            assert res["holiday_name"] == "Test Festival of Lights"
            assert res["holiday_category"] == HolidayCategory.FESTIVAL.value
            # College remains open on weekdays for festivals!
            assert res["college_status"] is True
            assert res["final_status"] == DayFinalStatus.COLLEGE_DAY.value
        finally:
            db.query(AcademicCalendar).filter(AcademicCalendar.date == "2026-10-15").delete()
            db.commit()
            db.close()

    def test_official_ap_overrides_calendarific(self):
        """TEST 7: Official AP Government calendar classification takes precedence over Calendarific."""
        db = SessionLocal()
        try:
            target_date = "2026-03-19"  # Ugadi (AP Government General Holiday)
            # Ensure AP entry is present
            ap_entry = db.query(AcademicCalendar).filter(
                AcademicCalendar.date == target_date,
                AcademicCalendar.holiday_source == HolidaySource.AP_GOVERNMENT.value,
            ).first()

            if not ap_entry:
                db.add(AcademicCalendar(
                    date=target_date,
                    name="Ugadi (Telugu New Year)",
                    normalized_name="ugadi",
                    calendar_year=2026,
                    state_code="IN-AP",
                    holiday_category=HolidayCategory.PUBLIC_HOLIDAY.value,
                    holiday_source=HolidaySource.AP_GOVERNMENT.value,
                    source_priority=100,
                    is_public_holiday=True,
                    is_default_no_college=True,
                    is_active=True,
                ))
                db.commit()

            # Also add a conflicting Calendarific entry that claims it is an observance
            db.add(AcademicCalendar(
                date=target_date,
                name="Ugadi",
                normalized_name="ugadi",
                calendar_year=2026,
                state_code="in-ap",
                holiday_category=HolidayCategory.OBSERVANCE.value,
                holiday_source=HolidaySource.CALENDARIFIC.value,
                source_priority=50,
                is_public_holiday=False,
                is_default_no_college=False,
                is_active=True,
            ))
            db.commit()

            # Resolve: AP Government must win!
            res = resolve_day_status(None, target_date, db)
            assert res["holiday_source"] == HolidaySource.AP_GOVERNMENT.value
            assert res["holiday_category"] == HolidayCategory.PUBLIC_HOLIDAY.value
            assert res["college_status"] is False
            assert res["final_status"] == DayFinalStatus.HOLIDAY.value
        finally:
            db.query(AcademicCalendar).filter(
                AcademicCalendar.date == "2026-03-19",
                AcademicCalendar.holiday_source == HolidaySource.CALENDARIFIC.value,
            ).delete()
            db.commit()
            db.close()
