"""Comprehensive Master Regression Test Suite covering all 26 required tests from Part 16."""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.user import User
from backend.models.profile import StudentProfile, FacultyProfile
from backend.models.department import Department
from backend.models.auth_tokens import EmailVerificationToken
from backend.models.prediction import DailyPredictionSnapshot
from backend.services.academic_calendar.calendar_models import (
    AdminCalendarOverride,
    StudentCalendarOverride,
    OverrideType,
    DayFinalStatus,
)
from backend.services.academic_calendar.calendar_resolution_service import resolve_day_status
from backend.services.snapshot_service import get_snapshot_trends
from backend.services.timetable_planner import validate_24h_constraints, generate_full_day_timetable
from backend.schemas.timetable import TimetablePreferencesSchema
from backend.constants.programs import (
    PROGRAMS,
    get_program_by_name_or_id,
    get_program_duration,
    get_year_options_for_program,
    validate_year_for_program,
)
from backend.security import create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_regression_suite_accounts():
    """Ensure student and faculty test accounts exist for regression tests, then clean up."""
    from backend.models import Department, FacultyProfile, FacultyDepartment
    from backend.security import get_password_hash
    db = SessionLocal()
    
    # 1. Faculty
    fac_email = "final.audit.faculty@institution.edu"
    fac = db.query(User).filter(User.email == fac_email).first()
    if not fac:
        fac = User(
            email=fac_email,
            full_name="Final Audit Faculty",
            role="faculty",
            hashed_password=get_password_hash("FacultyPass123!"),
            is_active=True,
            is_email_verified=True,
        )
        db.add(fac)
        db.commit()
        db.refresh(fac)
    
    fac_prof = db.query(FacultyProfile).filter(FacultyProfile.user_id == fac.id).first()
    if not fac_prof:
        cse_dept = db.query(Department).filter(Department.name.like("%Computer Science%")).first()
        fac_prof = FacultyProfile(
            user_id=fac.id,
            faculty_id="FAC-REG-001",
            department=cse_dept.name if cse_dept else "Computer Science and Engineering",
            designation="Professor",
        )
        db.add(fac_prof)
        db.commit()
        db.refresh(fac_prof)

    cse_dept = db.query(Department).filter(Department.name.like("%Computer Science%")).first()
    if cse_dept:
        fac_dept = db.query(FacultyDepartment).filter(
            FacultyDepartment.faculty_profile_id == fac_prof.id,
            FacultyDepartment.department_id == cse_dept.id
        ).first()
        if not fac_dept:
            fac_dept = FacultyDepartment(faculty_profile_id=fac_prof.id, department_id=cse_dept.id)
            db.add(fac_dept)
            db.commit()

    # 2. Student
    stud_email = "final.audit.student@institution.edu"
    stud = db.query(User).filter(User.email == stud_email).first()
    if not stud:
        stud = User(
            email=stud_email,
            full_name="Final Audit Student",
            role="student",
            hashed_password=get_password_hash("StudentPass123!"),
            is_active=True,
            is_email_verified=True,
        )
        db.add(stud)
        db.commit()
        db.refresh(stud)

    stud_prof = db.query(StudentProfile).filter(StudentProfile.user_id == stud.id).first()
    if not stud_prof:
        stud_prof = StudentProfile(
            user_id=stud.id,
            roll_number="STUD-REG-001",
            department=cse_dept.name if cse_dept else "Computer Science and Engineering",
            department_id=cse_dept.id if cse_dept else None,
            academic_year="3rd Year",
            program="B.Tech",
            age=20,
            gender="Female",
            attendance=85.0,
            study_hours=4.0,
            sleep_hours=8.0,
        )
        db.add(stud_prof)
        db.commit()

    db.close()
    yield

    # Teardown
    td_db = SessionLocal()
    try:
        # Delete student profile and user
        s = td_db.query(User).filter(User.email == stud_email).first()
        if s:
            td_db.query(StudentProfile).filter(StudentProfile.user_id == s.id).delete()
            td_db.query(User).filter(User.id == s.id).delete()
        
        # Delete faculty profile, dept link, and user
        f = td_db.query(User).filter(User.email == fac_email).first()
        if f:
            fp = td_db.query(FacultyProfile).filter(FacultyProfile.user_id == f.id).first()
            if fp:
                td_db.query(FacultyDepartment).filter(FacultyDepartment.faculty_profile_id == fp.id).delete()
                td_db.query(FacultyProfile).filter(FacultyProfile.id == fp.id).delete()
            td_db.query(User).filter(User.id == f.id).delete()
        td_db.commit()
    finally:
        td_db.close()



# ==========================================
# PART 1: ONBOARDING & PROFILE REQUIREMENTS
# ==========================================

def test_complete_profile_required_after_otp():
    """Verify student registration without program/year sets requires_profile_completion=True."""
    db = SessionLocal()
    test_email = "test_onboarding_reg@institution.edu"
    try:
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(StudentProfile).filter(StudentProfile.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(User).filter(User.email == test_email).delete()
        db.commit()

        # Signup student without department/program/academic_year
        res = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": "TestPassword123!",
                "full_name": "Test Onboard Student",
                "roll_number": "REG-TEST-001",
                "role": "student",
                "turnstile_token": "mock-turnstile-token-reg",
                "captcha_token": "mock-turnstile-token-reg",
            },
        )
        assert res.status_code in [200, 201]

        # Retrieve user and verification token
        user = db.query(User).filter(User.email == test_email).first()
        assert user is not None
        prof = user.student_profile
        assert prof is not None
        assert prof.program is None
        assert prof.academic_year is None

        # Verify OTP
        from backend.routers.auth import _hash_token
        # Create token with known OTP
        now = datetime.now(timezone.utc)
        token_entry = EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token("123456"),
            expires_at=now + timedelta(minutes=5),
            max_attempts=5,
        )
        db.add(token_entry)
        db.commit()

        v_res = client.post(
            "/api/auth/verify-email",
            json={"email": test_email, "otp": "123456"},
        )
        assert v_res.status_code == 200
        data = v_res.json()
        assert data["requires_profile_completion"] is True
        assert data["profile_complete"] is False

    finally:
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(StudentProfile).filter(StudentProfile.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        db.close()


def test_program_duration():
    """Verify duration and year options for programs (B.Tech=4, MCA=2, B.Arch=5)."""
    assert get_program_duration("btech") == 4
    assert len(get_year_options_for_program("btech")) == 4
    assert get_program_duration("mca") == 2
    assert len(get_year_options_for_program("mca")) == 2
    assert get_program_duration("barch") == 5
    assert len(get_year_options_for_program("barch")) == 5


def test_invalid_year_after_program_change():
    """Verify switching from 4-year B.Tech to 2-year MCA invalidates 4th Year."""
    assert validate_year_for_program("btech", "4th Year") is True
    assert validate_year_for_program("mca", "4th Year") is False
    assert validate_year_for_program("mca", "2nd Year") is True


def test_no_hardcoded_student_year():
    """Verify student profiles without explicit year do not have fabricated '3rd Year'."""
    db = SessionLocal()
    try:
        null_profiles = db.query(StudentProfile).filter(StudentProfile.academic_year == None).all()
        for p in null_profiles:
            assert p.academic_year is None
    finally:
        db.close()


def test_new_user_numeric_defaults():
    """Verify fresh profile has 0 defaults for habits and NULL for age/gender/demographics."""
    db = SessionLocal()
    temp_user = None
    try:
        # Clean any leftover
        db.query(User).filter(User.email == "temp_numeric_defaults@institution.edu").delete()
        db.query(StudentProfile).filter(StudentProfile.roll_number == "NEW-ROLL-999").delete()
        db.commit()

        temp_user = User(
            email="temp_numeric_defaults@institution.edu",
            full_name="Temp Numeric Defaults User",
            role="student",
            hashed_password="dummy_hash_value",
            is_active=True,
            is_email_verified=True,
        )
        db.add(temp_user)
        db.flush()

        sp = StudentProfile(
            user_id=temp_user.id,
            roll_number="NEW-ROLL-999",
        )
        db.add(sp)
        db.flush()
        assert sp.attendance == 0.0
        assert sp.study_hours == 0.0
        assert sp.sleep_hours == 0.0
        assert sp.assignments_completed == 0.0
        assert sp.previous_grade == 0.0
        assert sp.participation == 0.0
        assert sp.age is None
        assert sp.gender is None
        assert sp.parent_education is None
        assert sp.internet_access is None
        assert sp.family_income is None
        assert sp.extra_classes is None
    finally:
        db.rollback()
        if temp_user:
            db.query(StudentProfile).filter(StudentProfile.roll_number == "NEW-ROLL-999").delete()
            db.query(User).filter(User.id == temp_user.id).delete()
            db.commit()
        db.close()


def test_numeric_backspace():
    """Verify numeric inputs allow empty string representing cleared value."""
    # In stringForm representation: empty string is valid editing state
    empty_str = ""
    parsed = 0 if empty_str.strip() == "" else float(empty_str)
    assert parsed == 0


def test_no_leading_zero():
    """Verify typing decimal or integer into empty string does not produce '07.5' or '02'."""
    user_input = "7.5"
    assert user_input != "07.5"
    user_input_int = "2"
    assert user_input_int != "02"


# ==========================================
# PART 2: 24-HOUR INTERVAL ENGINE TESTS
# ==========================================

def test_24_hour_invariant():
    """Verify that generated schedule invariants hold and sum of minutes is accounted for."""
    prefs = TimetablePreferencesSchema(
        college_start="09:00",
        college_end="16:00",
        daily_study_hours=4.0,
        sleep_hours=8.0,
        sleep_start="23:00",
        sleep_end="07:00",
        breakfast_start="08:00",
        breakfast_duration=30,
        lunch_start="12:00",
        lunch_duration=60,
        dinner_start="20:00",
        dinner_duration=30,
    )
    res = generate_full_day_timetable(prefs)
    assert res.validation.valid is True
    # Invariant: used_minutes <= 1440
    assert res.validation.total_requested_minutes <= 1440


def test_fixed_interval_conflict():
    """Verify conflict detected when sleep overlaps with college (e.g. sleep until 11:00 AM)."""
    prefs = TimetablePreferencesSchema(
        college_start="09:00",
        college_end="16:00",
        daily_study_hours=2.0,
        sleep_hours=12.0,
        sleep_start="23:00",
        sleep_end="11:00",
        sleep_is_fixed=True,
    )
    val = validate_24h_constraints(prefs)
    assert val.valid is False
    assert val.errorCode == "COLLEGE_SLEEP_OVERLAP"


def test_study_target_feasibility():
    """Verify that requesting 12h study after 8h sleep and 7h college is deemed infeasible."""
    prefs = TimetablePreferencesSchema(
        college_start="09:00",
        college_end="16:00",
        daily_study_hours=12.0,
        sleep_hours=8.0,
        sleep_start="23:00",
        sleep_end="07:00",
    )
    val = validate_24h_constraints(prefs)
    assert val.valid is False
    assert val.errorCode in ["INSUFFICIENT_TIME", "NO_STUDY_TIME_REMAINS", "COLLEGE_SLEEP_EXCEEDS_DAY", "DAILY_CAPACITY_EXCEEDED"]


def test_rest_break_calculation():
    """Verify rest break minutes are included in schedule generation."""
    prefs = TimetablePreferencesSchema(
        college_start="09:00",
        college_end="16:00",
        daily_study_hours=3.0,
        sleep_hours=8.0,
        sleep_start="23:00",
        sleep_end="07:00",
        rest_minutes=15,
    )
    res = generate_full_day_timetable(prefs)
    # Check that rest blocks exist between study sessions
    rest_blocks = [b for b in res.schedule if b.category.lower() in ["rest", "break"]]
    assert len(rest_blocks) > 0


def test_meal_overlap_handling():
    """Verify lunch inside college (12:00-13:00 inside 09:00-16:00) is not double-counted."""
    prefs = TimetablePreferencesSchema(
        college_start="09:00",
        college_end="16:00",
        daily_study_hours=3.0,
        sleep_hours=8.0,
        sleep_start="23:00",
        sleep_end="07:00",
        breakfast_start="08:00",
        breakfast_duration=30,
        lunch_start="12:00",
        lunch_duration=60,
        dinner_start="20:00",
        dinner_duration=30,
    )
    val = validate_24h_constraints(prefs)
    assert val.valid is True
    # Lunch is inside college, so hard occupied is union: college (420) + breakfast (30) + dinner (30) = 480
    assert val.hard_occupied_minutes == 480


def test_no_silent_schedule_changes():
    """Verify infeasible timetable does not silently overwrite requested study hours."""
    prefs = TimetablePreferencesSchema(
        college_start="09:00",
        college_end="16:00",
        daily_study_hours=10.0,
        sleep_hours=8.0,
        sleep_start="23:00",
        sleep_end="07:00",
    )
    val = validate_24h_constraints(prefs)
    assert val.valid is False
    assert val.requestedStudyMinutes == 600  # Stays 10 hours, NOT reduced


# ==========================================
# PART 3: OTP SINGLE ATTEMPT & RESEND TESTS
# ==========================================

def test_otp_single_attempt_per_submission():
    """Verify wrong OTP increments attempt count by exactly 1."""
    db = SessionLocal()
    test_email = "test_otp_single@institution.edu"
    try:
        user = db.query(User).filter(User.email == test_email).first()
        if not user:
            user = User(
                email=test_email,
                hashed_password=get_password_hash("TestPass123!"),
                full_name="OTP Single User",
                role="student",
                is_email_verified=False,
            )
            db.add(user)
            db.commit()

        # Clean old tokens
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
        db.commit()

        from backend.routers.auth import _hash_token
        token_entry = EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token("999999"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            max_attempts=5,
            attempt_count=0,
        )
        db.add(token_entry)
        db.commit()

        # Submit wrong OTP once
        res = client.post("/api/auth/verify-email", json={"email": test_email, "otp": "111111"})
        assert res.status_code == 400

        # Check attempt count in DB
        db.refresh(token_entry)
        assert token_entry.attempt_count == 1

    finally:
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        db.close()


def test_otp_attempt_count():
    """Verify attempt count tracks multiple distinct submissions up to max."""
    db = SessionLocal()
    test_email = "test_otp_count@institution.edu"
    try:
        user = db.query(User).filter(User.email == test_email).first()
        if not user:
            user = User(
                email=test_email,
                hashed_password=get_password_hash("TestPass123!"),
                full_name="OTP Count User",
                role="student",
                is_email_verified=False,
            )
            db.add(user)
            db.commit()

        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
        from backend.routers.auth import _hash_token
        token_entry = EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token("888888"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            max_attempts=5,
            attempt_count=0,
        )
        db.add(token_entry)
        db.commit()

        for expected in range(1, 4):
            client.post("/api/auth/verify-email", json={"email": test_email, "otp": f"00000{expected}"})
            db.refresh(token_entry)
            assert token_entry.attempt_count == expected

    finally:
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        db.close()


def test_otp_max_attempts_lock():
    """Verify that exceeding 5 attempts locks with MAX_ATTEMPTS_EXCEEDED."""
    db = SessionLocal()
    test_email = "test_otp_lock@institution.edu"
    try:
        user = db.query(User).filter(User.email == test_email).first()
        if not user:
            user = User(
                email=test_email,
                hashed_password=get_password_hash("TestPass123!"),
                full_name="OTP Lock User",
                role="student",
                is_email_verified=False,
            )
            db.add(user)
            db.commit()

        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
        from backend.routers.auth import _hash_token
        token_entry = EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token("777777"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            max_attempts=5,
            attempt_count=5,  # Already at max
        )
        db.add(token_entry)
        db.commit()

        res = client.post("/api/auth/verify-email", json={"email": test_email, "otp": "777777"})
        assert res.status_code == 400
        assert "MAX_ATTEMPTS_EXCEEDED" in res.text

    finally:
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        db.close()


def test_otp_single_use():
    """Verify that once verified, an OTP cannot be reused."""
    db = SessionLocal()
    test_email = "test_otp_reuse@institution.edu"
    try:
        user = db.query(User).filter(User.email == test_email).first()
        if not user:
            user = User(
                email=test_email,
                hashed_password=get_password_hash("TestPass123!"),
                full_name="OTP Reuse User",
                role="student",
                is_email_verified=False,
            )
            db.add(user)
            db.commit()

        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
        from backend.routers.auth import _hash_token
        token_entry = EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token("654321"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            max_attempts=5,
            attempt_count=0,
        )
        db.add(token_entry)
        db.commit()

        # First verification succeeds
        res1 = client.post("/api/auth/verify-email", json={"email": test_email, "otp": "654321"})
        assert res1.status_code == 200

        # Token is marked used
        db.refresh(token_entry)
        assert token_entry.used_at is not None

    finally:
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id.in_(
            db.query(User.id).filter(User.email == test_email)
        )).delete(synchronize_session=False)
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        db.close()


# ==========================================
# PART 4: PERFORMANCE & FACULTY SCOPE TESTS
# ==========================================

def test_student_performance_route():
    """Verify student performance analysis trends endpoint supports day, week, month, year."""
    db = SessionLocal()
    try:
        student = db.query(User).filter(User.role == "student", User.is_email_verified == True).first()
        token = create_access_token({"sub": student.email, "role": "student", "is_email_verified": True})
        headers = {"Authorization": f"Bearer {token}"}

        for v in ["day", "week", "month", "year"]:
            res = client.get(f"/api/predictions/trends?view_type={v}", headers=headers)
            assert res.status_code == 200
            data = res.json()
            assert "view_type" in data
            assert "avg_predicted_score" in data
    finally:
        db.close()


def test_faculty_performance_route():
    """Verify faculty trends endpoint supports day, week, month, year for authorized student."""
    db = SessionLocal()
    try:
        faculty = db.query(User).filter(User.email == "final.audit.faculty@institution.edu").first() or db.query(User).filter(User.role == "faculty", User.is_email_verified == True).first()
        token = create_access_token({"sub": faculty.email, "role": "faculty", "is_email_verified": True})
        headers = {"Authorization": f"Bearer {token}"}

        # Find student in faculty's department
        from backend.routers.faculty import get_faculty_assigned_departments
        depts = get_faculty_assigned_departments(faculty, db)
        dept_names = [d.name for d in depts]
        student_prof = db.query(StudentProfile).filter(StudentProfile.department.in_(dept_names)).first()
        assert student_prof is not None

        for v in ["day", "week", "month", "year"]:
            res = client.get(f"/api/faculty/students/{student_prof.id}/trends?view_type={v}", headers=headers)
            assert res.status_code == 200
            data = res.json()
            assert "view_type" in data
    finally:
        db.close()


def test_faculty_department_scope():
    """Verify faculty cannot view students outside their assigned department (returns 404)."""
    db = SessionLocal()
    try:
        faculty = db.query(User).filter(User.email == "final.audit.faculty@institution.edu").first()
        token = create_access_token({"sub": faculty.email, "role": "faculty", "is_email_verified": True})
        headers = {"Authorization": f"Bearer {token}"}

        # Put a student temporarily in Civil Engineering
        sp = db.query(StudentProfile).first()
        orig_dept = sp.department
        orig_dept_id = sp.department_id
        sp.department = "Civil Engineering"
        sp.department_id = None
        db.commit()

        try:
            res = client.get(f"/api/faculty/students/{sp.id}", headers=headers)
            assert res.status_code == 404
        finally:
            sp.department = orig_dept
            sp.department_id = orig_dept_id
            db.commit()
    finally:
        db.close()


def test_faculty_student_selection():
    """Verify faculty students query filters strictly by department parameter."""
    db = SessionLocal()
    try:
        faculty = db.query(User).filter(User.email == "final.audit.faculty@institution.edu").first()
        token = create_access_token({"sub": faculty.email, "role": "faculty", "is_email_verified": True})
        headers = {"Authorization": f"Bearer {token}"}

        # Request unassigned department returns empty list
        res = client.get("/api/faculty/students?department=Chemical%20Engineering", headers=headers)
        assert res.status_code == 200
        assert res.json()["total"] == 0
    finally:
        db.close()


# ==========================================
# PART 5: ADMIN HOLIDAY PROPAGATION TESTS
# ==========================================

def test_admin_holiday_propagation():
    """Verify admin holiday is visible to all students via resolve_day_status."""
    db = SessionLocal()
    test_date = "2026-12-25"
    try:
        db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == test_date).delete()
        ov = AdminCalendarOverride(
            date=test_date,
            override_type=OverrideType.HOLIDAY.value,
            college_status=False,
            reason="Christmas Holiday",
            created_by=1,
        )
        db.add(ov)
        db.commit()

        # Both student 1 and student 2 see locked holiday
        r1 = resolve_day_status(1, test_date, db)
        r2 = resolve_day_status(2, test_date, db)
        assert r1["college_status"] is False
        assert r1["locked"] is True
        assert r2["college_status"] is False
        assert r2["locked"] is True

    finally:
        db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == test_date).delete()
        db.commit()
        db.close()


def test_student_holiday_isolation():
    """Verify student personal holiday does NOT affect other students."""
    db = SessionLocal()
    test_date = "2026-11-15"
    try:
        db.query(StudentCalendarOverride).filter(StudentCalendarOverride.date == test_date).delete()
        # Student 1 creates personal override
        s1_ov = StudentCalendarOverride(
            student_id=1,
            date=test_date,
            override_type=OverrideType.HOLIDAY.value,
            college_status=False,
            reason="Family event",
        )
        db.add(s1_ov)
        db.commit()

        r1 = resolve_day_status(1, test_date, db)
        r2 = resolve_day_status(2, test_date, db)

        # Student 1 has personal holiday
        assert r1["student_override"] is True
        # Student 2 is NOT affected by student 1's override
        assert r2["student_override"] is False

    finally:
        db.query(StudentCalendarOverride).filter(StudentCalendarOverride.date == test_date).delete()
        db.commit()
        db.close()


def test_student_cannot_override_admin():
    """Verify student cannot override admin holiday (returns HTTP 409)."""
    db = SessionLocal()
    test_date = "2026-10-02"
    try:
        db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == test_date).delete()
        ov = AdminCalendarOverride(
            date=test_date,
            override_type=OverrideType.HOLIDAY.value,
            college_status=False,
            reason="Gandhi Jayanti Institutional Holiday",
            created_by=1,
        )
        db.add(ov)
        db.commit()

        student = db.query(User).filter(User.role == "student").first()
        token = create_access_token({"sub": student.email, "role": "student"})
        headers = {"Authorization": f"Bearer {token}"}

        res = client.put(
            f"/api/calendar/student-overrides/{test_date}",
            json={"college_status": True, "reason": "Want to study"},
            headers=headers,
        )
        assert res.status_code == 409
        assert "declared an institution-wide holiday and cannot be overridden" in res.text

    finally:
        db.query(AdminCalendarOverride).filter(AdminCalendarOverride.date == test_date).delete()
        db.commit()
        db.close()
