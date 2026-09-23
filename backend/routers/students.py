import logging
logger = logging.getLogger(__name__)
from backend.services.prediction_service import execute_student_simulation
"""Student profile, academic indicators, timetable, and holiday router."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.models.profile import StudentProfile
from backend.models.prediction import PredictionRecord
from backend.models.timetable import StudentTimetablePreference, StudentHoliday, StudentCalendarSetting
from backend.schemas.student import StudentProfileResponse, StudentProfileUpdate
from backend.schemas.timetable import (
    TimetablePreferencesSchema,
    TimetableResponse,
    TimetableValidationResult,
    DayStatusResponse,
    HolidayToggleRequest,
    CalendarBusyEventSchema,
)
from backend.services.timetable_planner import (
    generate_full_day_timetable,
    validate_24h_constraints,
    _to_minutes,
    _to_hhmm,
)
from backend.services.date_service import get_day_info, is_sunday
from backend.services.google_calendar_service import (
    get_calendar_events_for_date,
    connect_student_calendar,
    disconnect_student_calendar,
)
from backend.security import require_role
from backend.ai.context_builder import build_student_ai_context

router = APIRouter(prefix="/students", tags=["Students"])



@router.get("/programs")
def get_student_programs():
    """Retrieve centralized academic programs catalogue."""
    from backend.constants.programs import PROGRAMS
    return {"programs": PROGRAMS}


@router.get("/profile", response_model=StudentProfileResponse)
def get_student_profile(
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve the profile and indicators for the authenticated student, attaching timetable timings."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    pref = db.query(StudentTimetablePreference).filter(
        StudentTimetablePreference.student_id == profile.id
    ).first()

    resp = StudentProfileResponse.model_validate(profile)
    if pref:
        resp.college_start = pref.college_start
        resp.college_end = pref.college_end
        resp.breakfast_start = pref.breakfast_start or "08:00"
        resp.breakfast_duration = pref.breakfast_duration or 30
        resp.lunch_start = pref.lunch_start or "13:00"
        resp.lunch_duration = pref.lunch_duration or 30
        resp.dinner_start = pref.dinner_start or "20:00"
        resp.dinner_duration = pref.dinner_duration or 30
        resp.break_reserve_minutes = getattr(pref, "break_reserve_minutes", 120) or 120
    return resp


@router.put("/profile", response_model=StudentProfileResponse)
def update_student_profile(
    payload: StudentProfileUpdate,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Update student profile, synchronizing canonical routine and executing automatic simulation ONCE."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    # 1. Validate numerical ranges
    if payload.attendance is not None and not (0.0 <= payload.attendance <= 100.0):
        raise HTTPException(status_code=422, detail="Attendance must be between 0 and 100")
    if payload.assignments_completed is not None and not (0.0 <= payload.assignments_completed <= 100.0):
        raise HTTPException(status_code=422, detail="Assignments completed must be between 0 and 100")
    if payload.previous_grade is not None and not (0.0 <= payload.previous_grade <= 100.0):
        raise HTTPException(status_code=422, detail="Previous grade must be between 0 and 100")
    if payload.participation is not None and not (0.0 <= payload.participation <= 100.0):
        raise HTTPException(status_code=422, detail="Participation must be between 0 and 100")
    if payload.study_hours is not None and not (0.0 <= payload.study_hours <= 16.0):
        raise HTTPException(status_code=422, detail="Study hours must be between 0 and 16")
    if payload.sleep_hours is not None and not (0.0 <= payload.sleep_hours <= 14.0):
        raise HTTPException(status_code=422, detail="Sleep hours must be between 0 and 14")

    # Fetch canonical routine preferences
    pref = db.query(StudentTimetablePreference).filter(
        StudentTimetablePreference.student_id == profile.id
    ).first()

    # 2. Check 24-hour capacity validation
    val_prefs = TimetablePreferencesSchema(
        college_start=payload.college_start or (pref.college_start if pref else "09:00"),
        college_end=payload.college_end or (pref.college_end if pref else "16:00"),
        breakfast_start=payload.breakfast_start or (pref.breakfast_start if pref else "08:00"),
        breakfast_duration=payload.breakfast_duration if payload.breakfast_duration is not None else (pref.breakfast_duration if pref else 30),
        lunch_start=payload.lunch_start or (pref.lunch_start if pref else "13:00"),
        lunch_duration=payload.lunch_duration if payload.lunch_duration is not None else (pref.lunch_duration if pref else 30),
        dinner_start=payload.dinner_start or (pref.dinner_start if pref else "20:00"),
        dinner_duration=payload.dinner_duration if payload.dinner_duration is not None else (pref.dinner_duration if pref else 30),
        break_reserve_minutes=payload.break_reserve_minutes if payload.break_reserve_minutes is not None else (getattr(pref, "break_reserve_minutes", 120) if pref else 120),
        daily_study_hours=payload.study_hours if payload.study_hours is not None else profile.study_hours,
        sleep_hours=payload.sleep_hours if payload.sleep_hours is not None else profile.sleep_hours,
    )
    val_res = validate_24h_constraints(val_prefs)
    if not val_res.valid:
        raise HTTPException(status_code=422, detail=val_res.message)

    update_data = payload.model_dump(exclude_unset=True)
    if "program" in update_data and update_data["program"]:
        from backend.constants.programs import get_program_by_name_or_id, validate_year_for_program, get_year_ordinal, get_year_number
        p_obj = get_program_by_name_or_id(update_data["program"])
        if p_obj:
            update_data["program"] = p_obj["id"]
            cur_yr = update_data.get("academic_year", profile.academic_year)
            if cur_yr and not validate_year_for_program(p_obj["id"], cur_yr):
                update_data["academic_year"] = None
    if "academic_year" in update_data and update_data["academic_year"]:
        from backend.constants.programs import get_year_ordinal, get_year_number
        yr_num = get_year_number(update_data["academic_year"])
        if yr_num:
            update_data["academic_year"] = get_year_ordinal(yr_num)

    # Academic indicator updates
    academic_fields = ["roll_number", "program", "academic_year", "age", "gender", "attendance",
                       "study_hours", "sleep_hours", "assignments_completed", "previous_grade",
                       "parent_education", "internet_access", "family_income", "extra_classes", "participation"]
    for f in academic_fields:
        if f in update_data:
            setattr(profile, f, update_data[f])

    if "department" in update_data:
        dept_name = update_data["department"]
        if dept_name:
            from backend.models.department import Department
            dept_obj = db.query(Department).filter(Department.name == dept_name).first()
            profile.department_id = dept_obj.id if dept_obj else None
        else:
            profile.department_id = None

    # Synchronize canonical routine into StudentTimetablePreference
    if not pref:
        pref = StudentTimetablePreference(
            student_id=profile.id,
            college_start=val_prefs.college_start,
            college_end=val_prefs.college_end,
            daily_study_hours=val_prefs.daily_study_hours,
            sleep_hours=val_prefs.sleep_hours,
            breakfast_start=val_prefs.breakfast_start,
            breakfast_duration=val_prefs.breakfast_duration,
            lunch_start=val_prefs.lunch_start,
            lunch_duration=val_prefs.lunch_duration,
            dinner_start=val_prefs.dinner_start,
            dinner_duration=val_prefs.dinner_duration,
            break_reserve_minutes=val_prefs.break_reserve_minutes,
        )
        db.add(pref)
    else:
        pref.college_start = val_prefs.college_start
        pref.college_end = val_prefs.college_end
        pref.daily_study_hours = val_prefs.daily_study_hours
        pref.sleep_hours = val_prefs.sleep_hours
        pref.breakfast_start = val_prefs.breakfast_start
        pref.breakfast_duration = val_prefs.breakfast_duration
        pref.lunch_start = val_prefs.lunch_start
        pref.lunch_duration = val_prefs.lunch_duration
        pref.dinner_start = val_prefs.dinner_start
        pref.dinner_duration = val_prefs.dinner_duration
        pref.break_reserve_minutes = val_prefs.break_reserve_minutes

    db.commit()
    db.refresh(profile)

    # AUTOMATIC SIMULATION: Run simulation ONCE for the saved profile
    try:
        execute_student_simulation(profile, db)
    except Exception as e:
        logger.warning(f"Auto-simulation failed during profile update: {e}")

    resp = StudentProfileResponse.model_validate(profile)
    resp.college_start = pref.college_start
    resp.college_end = pref.college_end
    resp.breakfast_start = pref.breakfast_start
    resp.breakfast_duration = pref.breakfast_duration
    resp.lunch_start = pref.lunch_start
    resp.lunch_duration = pref.lunch_duration
    resp.dinner_start = pref.dinner_start
    resp.dinner_duration = pref.dinner_duration
    resp.break_reserve_minutes = pref.break_reserve_minutes
    return resp



# =====================================================================
# DATE-AWARE & TIMETABLE ENDPOINTS
# =====================================================================

@router.get("/timetable/day-status", response_model=DayStatusResponse)
def get_timetable_day_status(
    date: Optional[str] = None,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve dynamic status of today or a target date, including Sunday, holiday, and calendar info."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    day_info = get_day_info(date)
    target_date = day_info["selected_date"]
    is_sun = day_info["is_sunday"]

    # Check institutional admin calendar override first
    from backend.models import AdminCalendarOverride
    admin_override = db.query(AdminCalendarOverride).filter(
        AdminCalendarOverride.date == target_date
    ).first()

    if admin_override:
        is_hol = not admin_override.college_status
        hol_label = (getattr(admin_override, "reason", None) or getattr(admin_override, "holiday_name", None)) or ("Institution Holiday" if is_hol else None)
    else:
        # Check student personal holiday
        hol = db.query(StudentHoliday).filter(
            StudentHoliday.student_id == profile.id,
            StudentHoliday.holiday_date == target_date,
        ).first()
        is_hol = bool(hol)
        hol_label = hol.label if hol else None

    # College is active if neither Sunday nor holiday
    college_active = not (is_sun or is_hol)

    # Check Google Calendar connection and events
    cal_events = get_calendar_events_for_date(profile.id, target_date, db)
    cal_setting = db.query(StudentCalendarSetting).filter(
        StudentCalendarSetting.student_id == profile.id
    ).first()
    cal_connected = bool(cal_setting and cal_setting.is_connected)

    # Check prediction staleness
    latest_pred = db.query(PredictionRecord).filter(
        PredictionRecord.student_id == profile.id
    ).order_by(PredictionRecord.created_at.desc()).first()
    pred_stale = bool(latest_pred and latest_pred.is_stale)
    stale_reason = latest_pred.stale_reason if (latest_pred and latest_pred.is_stale) else None

    return DayStatusResponse(
        current_date=day_info["current_date"],
        current_time=day_info["current_time"],
        selected_date=target_date,
        day_of_week=day_info["day_of_week"],
        timezone=day_info["timezone"],
        is_sunday=is_sun,
        is_holiday=is_hol,
        holiday_label=hol_label,
        college_active=college_active,
        prediction_is_stale=pred_stale,
        prediction_stale_reason=stale_reason,
        calendar_connected=cal_connected,
        calendar_events=cal_events,
    )


@router.post("/timetable/holiday")
def toggle_holiday(
    payload: HolidayToggleRequest,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Mark or unmark a date as a holiday for the authenticated student."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    hol = db.query(StudentHoliday).filter(
        StudentHoliday.student_id == profile.id,
        StudentHoliday.holiday_date == payload.date,
    ).first()

    if payload.is_holiday:
        if not hol:
            hol = StudentHoliday(
                student_id=profile.id,
                holiday_date=payload.date,
                label=payload.label or "College Holiday",
            )
            db.add(hol)
        else:
            hol.label = payload.label or "College Holiday"
    else:
        if hol:
            db.delete(hol)

    db.commit()
    return {"status": "success", "date": payload.date, "is_holiday": payload.is_holiday}


@router.get("/timetable/holidays")
def list_student_holidays(
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """List all saved holidays for the authenticated student."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    holidays = db.query(StudentHoliday).filter(
        StudentHoliday.student_id == profile.id
    ).all()
    return [{"date": h.holiday_date, "label": h.label} for h in holidays]


@router.post("/timetable/calendar/connect")
def connect_calendar(
    payload: Dict[str, Any],
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Connect Google Calendar (or configure demo/mock calendar) for student."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    access_token = payload.get("access_token")
    calendar_email = payload.get("calendar_email")
    mock_events = payload.get("mock_events")
    setting = connect_student_calendar(profile.id, db, access_token, calendar_email, mock_events)
    return {"status": "connected", "calendar_email": setting.calendar_email}


@router.post("/timetable/calendar/disconnect")
def disconnect_calendar(
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Disconnect Google Calendar for student."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    disconnect_student_calendar(profile.id, db)
    return {"status": "disconnected"}


@router.get("/timetable/calendar/events")
def get_student_calendar_events(
    date: str,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve calendar events for a specific date."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    events = get_calendar_events_for_date(profile.id, date, db)
    return events


@router.get("/timetable/preferences", response_model=TimetablePreferencesSchema)
def get_timetable_preferences(
    date: Optional[str] = None,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Retrieve study timetable preferences for the authenticated student, loading profile initial values."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    day_info = get_day_info(date)
    target_date = day_info["selected_date"]

    # Check holiday status for target date
    hol = db.query(StudentHoliday).filter(
        StudentHoliday.student_id == profile.id,
        StudentHoliday.holiday_date == target_date,
    ).first()
    is_hol = bool(hol)
    hol_label = hol.label if hol else None

    # Get calendar events for target date
    cal_events = get_calendar_events_for_date(profile.id, target_date, db)

    profile_study = float(profile.study_hours) if profile.study_hours is not None else 2.0
    profile_sleep = float(profile.sleep_hours) if profile.sleep_hours is not None else 8.0

    pref = db.query(StudentTimetablePreference).filter(
        StudentTimetablePreference.student_id == profile.id
    ).first()

    if not pref:
        sleep_start = "23:00"
        wake_m = (_to_minutes(sleep_start) + int(round(profile_sleep * 60))) % 1440
        sleep_end = _to_hhmm(wake_m)
        return TimetablePreferencesSchema(
            college_start="09:00",
            college_end="16:00",
            daily_study_hours=profile_study,
            sleep_hours=profile_sleep,
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            rest_minutes=15,
            meal_minutes=30,
            preferred_study_period="evening",
            session_length_preference="standard",
            selected_date=target_date,
            is_holiday=is_hol,
            holiday_label=hol_label,
            calendar_events=cal_events,
            profile_study_hours=profile_study,
            profile_sleep_hours=profile_sleep,
        )

    # Maintain bidirectional synchronization with profile values
    study_h = profile_study
    sleep_h = profile_sleep

    if pref.daily_study_hours != study_h or pref.sleep_hours != sleep_h:
        pref.daily_study_hours = study_h
        pref.sleep_hours = sleep_h
        db.commit()

    return TimetablePreferencesSchema(
        college_start=pref.college_start,
        college_end=pref.college_end,
        daily_study_hours=study_h,
        sleep_hours=sleep_h,
        sleep_start=pref.sleep_start,
        sleep_end=pref.sleep_end,
        rest_minutes=pref.rest_minutes,
        meal_minutes=pref.meal_minutes,
        preferred_study_period=pref.preferred_study_period,
        session_length_preference=pref.session_length_preference,
        selected_date=target_date,
        is_holiday=is_hol,
        holiday_label=hol_label,
        calendar_events=cal_events,
        day_of_week=pref.day_of_week,
        is_enabled=pref.is_enabled,
        custom_day_preferences=pref.custom_day_preferences,
        profile_study_hours=profile_study,
        profile_sleep_hours=profile_sleep,
    )


@router.post("/timetable/validate", response_model=TimetableValidationResult)
def validate_timetable_configuration(
    payload: TimetablePreferencesSchema,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Perform real-time 24-hour capacity and feasibility validation without saving."""
    profile = current_user.student_profile
    if profile and not payload.calendar_events:
        target_date = payload.selected_date or get_day_info()["selected_date"]
        payload.calendar_events = get_calendar_events_for_date(profile.id, target_date, db)
    return validate_24h_constraints(payload)


@router.post("/timetable/preferences", response_model=TimetablePreferencesSchema)
def save_timetable_preferences(
    payload: TimetablePreferencesSchema,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Persist timetable preferences, synchronizing canonical profile and triggering auto-simulation."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    # Validate 24h constraints
    val_res = validate_24h_constraints(payload)
    if not val_res.valid:
        raise HTTPException(status_code=422, detail=val_res.message)

    pref = db.query(StudentTimetablePreference).filter(
        StudentTimetablePreference.student_id == profile.id
    ).first()

    if not pref:
        pref = StudentTimetablePreference(student_id=profile.id)
        db.add(pref)

    pref.college_start = payload.college_start
    pref.college_end = payload.college_end
    pref.daily_study_hours = payload.daily_study_hours
    pref.sleep_hours = payload.sleep_hours
    pref.sleep_start = payload.sleep_start
    pref.rest_minutes = payload.rest_minutes
    pref.breakfast_start = payload.breakfast_start
    pref.breakfast_duration = payload.breakfast_duration
    pref.lunch_start = payload.lunch_start
    pref.lunch_duration = payload.lunch_duration
    pref.dinner_start = payload.dinner_start
    pref.dinner_duration = payload.dinner_duration
    pref.break_reserve_minutes = payload.break_reserve_minutes
    pref.sleep_is_fixed = payload.sleep_is_fixed
    pref.min_sleep_hours = payload.min_sleep_hours
    pref.max_sleep_hours = payload.max_sleep_hours
    pref.min_study_hours = payload.min_study_hours
    pref.max_study_hours = payload.max_study_hours
    pref.preferred_study_period = payload.preferred_study_period
    pref.session_length_preference = payload.session_length_preference

    # BIDIRECTIONAL SYNC: Synchronize study_hours and sleep_hours onto StudentProfile
    profile.study_hours = payload.daily_study_hours
    profile.sleep_hours = payload.sleep_hours

    db.commit()

    # AUTOMATIC SIMULATION: Run simulation ONCE for the saved profile
    try:
        execute_student_simulation(profile, db)
    except Exception as e:
        logger.warning(f"Auto-simulation failed during timetable preference save: {e}")

    return payload


@router.post("/timetable/generate", response_model=TimetableResponse)
def generate_student_timetable(
    payload: TimetablePreferencesSchema,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Generate a personalized, non-overlapping daily timetable after strict 24-hour validation."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    target_date = payload.selected_date or get_day_info()["selected_date"]
    if not payload.calendar_events:
        payload.calendar_events = get_calendar_events_for_date(profile.id, target_date, db)

    # Persist the preferences for this student
    save_timetable_preferences(payload, current_user, db)

    # Gather live student context for priority study topics
    context = build_student_ai_context(db, current_user)
    candidates = []
    for s in context.get("top_shap_factors", []):
        candidates.append({"focus_area": s.get("feature", "")})

    # Return generated schedule (or partial preview with mathematical shortfall explanation if capacity exceeded)
    return generate_full_day_timetable(payload, candidates)
