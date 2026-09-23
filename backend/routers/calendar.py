"""Academic Calendar API router.

Endpoints:
- GET  /api/calendar/day?date=YYYY-MM-DD         — resolved day status
- GET  /api/calendar/month?year=YYYY&month=MM     — month holidays/events
- GET  /api/calendar/year?year=YYYY               — full year academic calendar
- PUT  /api/calendar/student-overrides/{date}     — create/update student override
- DELETE /api/calendar/student-overrides/{date}   — revert to system calendar
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.security import require_role
from backend.models.user import User
from backend.services.date_service import get_day_info
from backend.services.academic_calendar.calendar_models import (
    StudentCalendarOverride,
    OverrideType,
)
from backend.services.academic_calendar.calendar_resolution_service import (
    resolve_day_status,
    get_month_calendar,
    get_year_calendar,
)
from backend.services.academic_calendar.calendar_schemas import (
    DayResolutionResponse,
    CalendarMonthResponse,
    CalendarYearResponse,
    CalendarEntryResponse,
    StudentOverrideRequest,
    StudentOverrideResponse,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/day", response_model=DayResolutionResponse)
def get_day_status(
    date: Optional[str] = None,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Get resolved day status for a specific date."""
    profile = current_user.student_profile
    student_id = profile.id if profile else None

    if not date:
        day_info = get_day_info()
        date = day_info["selected_date"]

    result = resolve_day_status(student_id, date, db)
    return DayResolutionResponse(**result)


@router.get("/month", response_model=CalendarMonthResponse)
def get_month_status(
    year: int,
    month: int,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Get all calendar entries for a month with resolved statuses."""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    if not (2020 <= year <= 2030):
        raise HTTPException(status_code=400, detail="Year must be between 2020 and 2030")

    profile = current_user.student_profile
    student_id = profile.id if profile else None

    days = get_month_calendar(year, month, student_id, db)
    day_responses = [DayResolutionResponse(**d) for d in days]

    return CalendarMonthResponse(year=year, month=month, days=day_responses)


@router.get("/year", response_model=CalendarYearResponse)
def get_year_status(
    year: int,
    current_user: User = Depends(require_role(["student", "faculty", "admin"])),
    db: Session = Depends(get_db),
):
    """Get full year academic calendar entries."""
    if not (2020 <= year <= 2030):
        raise HTTPException(status_code=400, detail="Year must be between 2020 and 2030")

    entries = get_year_calendar(year, db)
    entry_responses = [CalendarEntryResponse(**e) for e in entries]

    public_count = sum(1 for e in entries if e.get("is_public_holiday"))
    optional_count = sum(1 for e in entries if not e.get("is_public_holiday") and e.get("category") == "OPTIONAL_HOLIDAY")

    return CalendarYearResponse(
        year=year,
        entries=entry_responses,
        total_public_holidays=public_count,
        total_optional_holidays=optional_count,
    )


@router.put("/student-overrides/{date}", response_model=StudentOverrideResponse)
def create_student_override(
    date: str,
    payload: StudentOverrideRequest,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Create or update a student calendar override for a specific date."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    # ENFORCE LEVEL 1 HIERARCHY: Admin / Institution Override cannot be overridden by student
    from backend.services.academic_calendar.calendar_models import AdminCalendarOverride
    admin_override = db.query(AdminCalendarOverride).filter(
        AdminCalendarOverride.date == date,
    ).first()
    if admin_override:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This date has been declared an institution-wide holiday and cannot be overridden.",
        )

    override_type = OverrideType.COLLEGE_DAY.value if payload.college_status else OverrideType.HOLIDAY.value

    existing = db.query(StudentCalendarOverride).filter(
        StudentCalendarOverride.student_id == profile.id,
        StudentCalendarOverride.date == date,
    ).first()

    if existing:
        existing.override_type = override_type
        existing.college_status = payload.college_status
        existing.reason = payload.reason
        message = "Override updated"
    else:
        db.add(StudentCalendarOverride(
            student_id=profile.id,
            date=date,
            override_type=override_type,
            college_status=payload.college_status,
            reason=payload.reason,
        ))
        message = "Override created"

    db.commit()

    return StudentOverrideResponse(
        date=date,
        override_type=override_type,
        college_status=payload.college_status,
        reason=payload.reason,
        message=message,
    )


@router.delete("/student-overrides/{date}")
def delete_student_override(
    date: str,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Delete a student calendar override, reverting to system calendar behavior."""
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    existing = db.query(StudentCalendarOverride).filter(
        StudentCalendarOverride.student_id == profile.id,
        StudentCalendarOverride.date == date,
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="No override found for this date")

    db.delete(existing)
    db.commit()

    return {"date": date, "message": "Override removed. Reverted to system calendar."}


@router.post("/sync")
def trigger_calendar_sync(
    year: Optional[int] = Query(None, description="Calendar year to sync"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Manually trigger academic calendar sync using Calendarific v2."""
    from backend.services.academic_calendar.calendar_sync_service import sync_calendar_for_year
    from backend.services.academic_calendar.calendarific_client import CalendarificClient
    from backend.config import cal_settings

    if not year:
        from backend.services.date_service import get_current_kolkata_datetime
        year = get_current_kolkata_datetime().year

    client = CalendarificClient(
        api_key=cal_settings.CALENDARIFIC_API_KEY,
        base_url=cal_settings.CALENDARIFIC_BASE_URL,
        country=cal_settings.CALENDARIFIC_COUNTRY,
        location=cal_settings.CALENDARIFIC_LOCATION,
    )
    result = sync_calendar_for_year(db, client, year, force=True)
    msg = result.get("message") or f"Calendar sync completed for {year}."
    return {"message": msg, "result": result}
