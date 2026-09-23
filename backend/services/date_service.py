"""Timezone-aware Date and Time Service for Timetable Planning.

Uses Asia/Kolkata as the authoritative project timezone.
Dynamically evaluates current date, time, and day-of-week.
"""
from datetime import datetime, date, time
from typing import Tuple, Optional, Dict, Any
import zoneinfo

DEFAULT_TIMEZONE_STR = "Asia/Kolkata"


def get_timezone(tz_name: Optional[str] = None) -> zoneinfo.ZoneInfo:
    """Return ZoneInfo object, defaulting to Asia/Kolkata."""
    name = tz_name or DEFAULT_TIMEZONE_STR
    try:
        return zoneinfo.ZoneInfo(name)
    except Exception:
        return zoneinfo.ZoneInfo(DEFAULT_TIMEZONE_STR)


def get_current_kolkata_datetime(tz_name: Optional[str] = None) -> datetime:
    """Return timezone-aware current datetime."""
    tz = get_timezone(tz_name)
    return datetime.now(tz)


def get_day_info(date_str: Optional[str] = None, tz_name: Optional[str] = None) -> Dict[str, Any]:
    """Return dynamic date and day-of-week info for a given date or today in the given timezone.

    Returns:
        current_date (YYYY-MM-DD)
        current_time (HH:MM)
        selected_date (YYYY-MM-DD)
        day_of_week (e.g. 'Sunday', 'Monday')
        is_sunday (bool)
        timezone (str)
    """
    tz = get_timezone(tz_name)
    now = datetime.now(tz)

    if date_str and date_str.strip():
        try:
            dt = datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
            target_date_str = dt.strftime("%Y-%m-%d")
            day_name = dt.strftime("%A")
            is_sun = (dt.weekday() == 6)  # Sunday is 6 in Python
        except ValueError:
            target_date_str = now.strftime("%Y-%m-%d")
            day_name = now.strftime("%A")
            is_sun = (now.weekday() == 6)
    else:
        target_date_str = now.strftime("%Y-%m-%d")
        day_name = now.strftime("%A")
        is_sun = (now.weekday() == 6)

    return {
        "current_date": now.strftime("%Y-%m-%d"),
        "current_time": now.strftime("%H:%M"),
        "selected_date": target_date_str,
        "day_of_week": day_name,
        "is_sunday": is_sun,
        "timezone": tz_name or DEFAULT_TIMEZONE_STR,
    }


def is_sunday(date_str: Optional[str] = None, tz_name: Optional[str] = None) -> bool:
    """Check if the target date (or current date if None) is Sunday."""
    info = get_day_info(date_str, tz_name)
    return info["is_sunday"]
