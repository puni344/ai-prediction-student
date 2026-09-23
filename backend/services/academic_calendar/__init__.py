"""Academic Calendar Service package.

Exports:
- Models: AcademicCalendar, StudentCalendarOverride, AdminCalendarOverride
- Enums: HolidayCategory, HolidaySource, OverrideType, DayFinalStatus
- Services: HolidayAPIClient, resolve_day_status, sync_calendar
"""
from backend.services.academic_calendar.calendar_models import (
    AcademicCalendar,
    StudentCalendarOverride,
    AdminCalendarOverride,
    HolidayCategory,
    HolidaySource,
    OverrideType,
    DayFinalStatus,
)
from backend.services.academic_calendar.calendar_resolution_service import resolve_day_status
from backend.services.academic_calendar.holiday_api_client import HolidayAPIClient

__all__ = [
    "AcademicCalendar",
    "StudentCalendarOverride",
    "AdminCalendarOverride",
    "HolidayCategory",
    "HolidaySource",
    "OverrideType",
    "DayFinalStatus",
    "resolve_day_status",
    "HolidayAPIClient",
]
