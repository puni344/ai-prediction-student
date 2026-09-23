"""Day Resolution Service — single authoritative backend function.

resolve_day_status(student_id, target_date, db)

MANDATORY 6-TIER HIERARCHY:
1. ADMIN / INSTITUTION OVERRIDE (Highest — locked for all students, student cannot override)
2. STUDENT PERSONAL OVERRIDE (Applies only to that student, never modifies shared calendar)
3. VERIFIED OFFICIAL AP GOVERNMENT CALENDAR (Authoritative, cannot be overwritten by provider)
4. CALENDARIFIC HOLIDAY DATA (Supporting reference/enrichment; festivals/observances do NOT cancel college)
5. SUNDAY / WEEKLY OFF RULE (Default no college)
6. NORMAL COLLEGE DAY (Standard scheduled hours)
"""
from datetime import datetime as dt
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session

from backend.services.academic_calendar.calendar_models import (
    AcademicCalendar,
    StudentCalendarOverride,
    AdminCalendarOverride,
    HolidayCategory,
    HolidaySource,
    DayFinalStatus,
)


def resolve_day_status(
    student_id: Optional[int],
    target_date: str,
    db: Session,
) -> Dict[str, Any]:
    """Resolve the authoritative day status for a student on a given date.

    Implements the non-negotiable 6-tier hierarchy:
    1. Admin / Institution Override (locked for all students)
    2. Student Personal Override (only that student)
    3. Verified Official AP Government Calendar
    4. Calendarific Provider Data (festivals/observances remain college days unless holiday)
    5. Sunday Rule
    6. Normal College Day

    Returns:
        Dict containing full day resolution fields and metadata.
    """
    # 1. Parse date
    try:
        parsed_date = dt.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        parsed_date = dt.now().date()
        target_date = parsed_date.strftime("%Y-%m-%d")

    day_of_week = parsed_date.strftime("%A")
    is_sunday = parsed_date.weekday() == 6

    # Base template
    result: Dict[str, Any] = {
        "date": target_date,
        "day_of_week": day_of_week,
        "holiday": False,
        "holiday_name": None,
        "holiday_source": None,
        "holiday_category": None,
        "is_optional_holiday": False,
        "default_college": True,
        "student_override": False,
        "student_override_reason": None,
        "admin_override": False,
        "admin_override_reason": None,
        "college_status": True,
        "final_status": DayFinalStatus.COLLEGE_DAY.value,
        "locked": False,
        "override_scope": None,
    }

    # ─────────────────────────────────────────────────────────────
    # LEVEL 1: ADMIN / INSTITUTION OVERRIDE (HIGHEST PRIORITY)
    # ─────────────────────────────────────────────────────────────
    admin_override = db.query(AdminCalendarOverride).filter(
        AdminCalendarOverride.date == target_date,
    ).first()

    if admin_override:
        result["admin_override"] = True
        result["admin_override_reason"] = admin_override.reason
        result["locked"] = True
        result["override_scope"] = "INSTITUTION"
        result["holiday_source"] = HolidaySource.ADMIN_MANUAL.value

        if not admin_override.college_status:
            # Institution holiday declared by admin
            result["holiday"] = True
            result["holiday_name"] = admin_override.reason or "Institution Holiday"
            result["holiday_category"] = HolidayCategory.SPECIAL_NON_WORKING_DAY.value
            result["default_college"] = False
            result["college_status"] = False
            result["final_status"] = DayFinalStatus.HOLIDAY.value
        else:
            # Institution working day declared by admin
            result["holiday"] = False
            result["default_college"] = True
            result["college_status"] = True
            result["final_status"] = DayFinalStatus.COLLEGE_DAY.value

        # Admin override is locked: students CANNOT override
        return result

    # ─────────────────────────────────────────────────────────────
    # LEVEL 2: STUDENT PERSONAL OVERRIDE
    # ─────────────────────────────────────────────────────────────
    if student_id:
        student_override = db.query(StudentCalendarOverride).filter(
            StudentCalendarOverride.student_id == student_id,
            StudentCalendarOverride.date == target_date,
        ).first()

        if student_override:
            result["student_override"] = True
            result["student_override_reason"] = student_override.reason
            result["override_scope"] = "STUDENT"
            result["locked"] = False

            if not student_override.college_status:
                # Student marked as personal holiday
                result["holiday"] = True
                result["holiday_name"] = student_override.reason or "Personal Holiday"
                result["holiday_category"] = "PERSONAL_HOLIDAY"
                result["default_college"] = False
                result["college_status"] = False
                result["final_status"] = DayFinalStatus.HOLIDAY.value
            else:
                # Student marked as attending college
                result["holiday"] = False
                result["default_college"] = True
                result["college_status"] = True
                result["final_status"] = DayFinalStatus.COLLEGE_DAY.value

            return result

    # ─────────────────────────────────────────────────────────────
    # LEVEL 3: VERIFIED OFFICIAL AP GOVERNMENT CALENDAR
    # ─────────────────────────────────────────────────────────────
    ap_entry = db.query(AcademicCalendar).filter(
        AcademicCalendar.date == target_date,
        AcademicCalendar.holiday_source == HolidaySource.AP_GOVERNMENT.value,
        AcademicCalendar.is_active == True,
    ).first()

    if ap_entry:
        result["holiday"] = True
        result["holiday_name"] = ap_entry.name
        result["holiday_source"] = HolidaySource.AP_GOVERNMENT.value
        result["holiday_category"] = ap_entry.holiday_category

        is_optional = ap_entry.holiday_category == HolidayCategory.OPTIONAL_HOLIDAY.value
        result["is_optional_holiday"] = is_optional

        if ap_entry.is_default_no_college:
            result["default_college"] = False
            result["college_status"] = False
            result["final_status"] = DayFinalStatus.HOLIDAY.value
        else:
            # Optional holiday: college active by default
            result["default_college"] = True
            result["college_status"] = True
            result["final_status"] = DayFinalStatus.OPTIONAL_HOLIDAY.value

        return result

    # ─────────────────────────────────────────────────────────────
    # LEVEL 4: CALENDARIFIC HOLIDAY DATA
    # ─────────────────────────────────────────────────────────────
    cal_entry = db.query(AcademicCalendar).filter(
        AcademicCalendar.date == target_date,
        AcademicCalendar.holiday_source.in_([HolidaySource.CALENDARIFIC.value, "HOLIDAY_API"]),
        AcademicCalendar.is_active == True,
    ).first()

    if cal_entry:
        result["holiday"] = True
        result["holiday_name"] = cal_entry.name
        result["holiday_source"] = HolidaySource.CALENDARIFIC.value
        result["holiday_category"] = cal_entry.holiday_category

        is_public = cal_entry.holiday_category == HolidayCategory.PUBLIC_HOLIDAY.value
        is_optional = cal_entry.holiday_category == HolidayCategory.OPTIONAL_HOLIDAY.value
        is_festival = cal_entry.holiday_category == HolidayCategory.FESTIVAL.value
        is_observance = cal_entry.holiday_category == HolidayCategory.OBSERVANCE.value

        result["is_optional_holiday"] = is_optional

        if is_public and cal_entry.is_default_no_college:
            # Genuine public holiday: college closed by default
            result["default_college"] = False
            result["college_status"] = False
            result["final_status"] = DayFinalStatus.HOLIDAY.value
            return result
        elif is_optional:
            # Optional holiday: college open by default
            result["default_college"] = True
            result["college_status"] = True
            result["final_status"] = DayFinalStatus.OPTIONAL_HOLIDAY.value
            return result
        elif is_festival or is_observance:
            # Festival / Observance: INFORMATIONAL ONLY!
            # If on a weekday, normal college remains scheduled unless user overrides.
            if is_sunday:
                result["default_college"] = False
                result["college_status"] = False
                result["final_status"] = DayFinalStatus.SUNDAY_OFF.value
            else:
                result["default_college"] = True
                result["college_status"] = True
                result["final_status"] = DayFinalStatus.COLLEGE_DAY.value
            return result
        else:
            if cal_entry.is_default_no_college:
                result["default_college"] = False
                result["college_status"] = False
                result["final_status"] = DayFinalStatus.HOLIDAY.value
                return result

    # ─────────────────────────────────────────────────────────────
    # LEVEL 5: SUNDAY / WEEKLY OFF
    # ─────────────────────────────────────────────────────────────
    if is_sunday:
        result["holiday"] = False
        result["default_college"] = False
        result["college_status"] = False
        result["final_status"] = DayFinalStatus.SUNDAY_OFF.value
        return result

    # ─────────────────────────────────────────────────────────────
    # LEVEL 6: NORMAL COLLEGE DAY
    # ─────────────────────────────────────────────────────────────
    result["holiday"] = False
    result["default_college"] = True
    result["college_status"] = True
    result["final_status"] = DayFinalStatus.COLLEGE_DAY.value
    return result


def get_month_calendar(
    year: int,
    month: int,
    student_id: Optional[int],
    db: Session,
) -> List[Dict[str, Any]]:
    """Get all calendar entries for a month with resolved statuses."""
    import calendar

    _, days_in_month = calendar.monthrange(year, month)
    entries = []

    for day in range(1, days_in_month + 1):
        date_str = f"{year:04d}-{month:02d}-{day:02d}"
        status = resolve_day_status(student_id, date_str, db)
        entries.append(status)

    return entries


def get_year_calendar(
    year: int,
    db: Session,
) -> List[Dict[str, Any]]:
    """Get all academic calendar entries for a year."""
    entries = db.query(AcademicCalendar).filter(
        AcademicCalendar.calendar_year == year,
        AcademicCalendar.is_active == True,
    ).order_by(
        AcademicCalendar.date
    ).all()

    return [
        {
            "date": e.date,
            "name": e.name,
            "category": e.holiday_category,
            "source": e.holiday_source,
            "is_public_holiday": e.is_public_holiday,
            "is_default_no_college": e.is_default_no_college,
            "description": e.description,
        }
        for e in entries
    ]
