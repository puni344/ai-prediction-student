"""Official Andhra Pradesh Government Holiday Calendar.

Source: G.O. Rt. No. 2276, Dated: 04.12.2025
Andhra Pradesh 2026 General and Optional Holidays.

General Holidays are PUBLIC_HOLIDAY with is_default_no_college=True.
Optional Holidays are OPTIONAL_HOLIDAY with is_default_no_college=False.

A festival != automatically college holiday.
Only entries classified as PUBLIC_HOLIDAY should default to no-college.
"""
from datetime import datetime, timezone
from typing import List, Dict
from sqlalchemy.orm import Session

from backend.services.academic_calendar.calendar_models import (
    AcademicCalendar,
    HolidayCategory,
    HolidaySource,
)

# ─── 2026 AP Government General Holidays (is_default_no_college=True) ───
AP_2026_GENERAL_HOLIDAYS = [
    {"date": "2026-01-01", "name": "New Year's Day", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-01-13", "name": "Bhogi", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-01-14", "name": "Makara Sankranti", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-01-15", "name": "Kanuma", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-01-26", "name": "Republic Day", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-02-26", "name": "Maha Shivaratri", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-03-19", "name": "Ugadi (Telugu New Year)", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-03-31", "name": "Id-ul-Fitr (Ramzan)", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-04-02", "name": "Sri Rama Navami", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-04-06", "name": "Mahavir Jayanti", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-04-14", "name": "Dr. B.R. Ambedkar Jayanti", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-04-18", "name": "Good Friday", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-05-01", "name": "May Day", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-05-25", "name": "Buddha Purnima", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-06-07", "name": "Id-ul-Adha (Bakrid)", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-07-07", "name": "Muharram", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-08-15", "name": "Independence Day", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-08-21", "name": "Sri Krishna Janmashtami", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-09-05", "name": "Milad-un-Nabi (Prophet's Birthday)", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-10-01", "name": "Mahatma Gandhi Jayanti / Vijaya Dashami (Dussehra)", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-10-02", "name": "Mahatma Gandhi Jayanti", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-10-20", "name": "Naraka Chaturdasi", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-10-21", "name": "Deepavali", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-11-01", "name": "Andhra Pradesh Formation Day / All Saints Day", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-11-02", "name": "Kartika Purnima", "category": HolidayCategory.PUBLIC_HOLIDAY},
    {"date": "2026-12-25", "name": "Christmas", "category": HolidayCategory.PUBLIC_HOLIDAY},
]

# ─── 2026 AP Government Optional Holidays (is_default_no_college=False) ───
AP_2026_OPTIONAL_HOLIDAYS = [
    {"date": "2026-01-06", "name": "Guru Gobind Singh Jayanti", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-01-23", "name": "Netaji Subhas Chandra Bose Jayanti", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-02-19", "name": "Shivaji Jayanti", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-03-14", "name": "Holi", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-04-01", "name": "Annual Closing of Accounts", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-04-20", "name": "Easter Sunday", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-05-09", "name": "Ravindranath Tagore Jayanti", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-07-06", "name": "Rath Yatra", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-08-12", "name": "Varalakshmi Vratam", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-08-26", "name": "Vinayaka Chavithi", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-09-17", "name": "Anant Chaturdashi", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-10-22", "name": "Deepavali Holiday (Day 2)", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-11-14", "name": "Children's Day / Nehru Jayanti", "category": HolidayCategory.OPTIONAL_HOLIDAY},
    {"date": "2026-12-24", "name": "Christmas Eve", "category": HolidayCategory.OPTIONAL_HOLIDAY},
]


def _normalize_name(name: str) -> str:
    """Normalize holiday name for deduplication."""
    return name.strip().lower().replace("'", "").replace("-", " ")


def seed_ap_government_holidays(db: Session, year: int = 2026) -> int:
    """Upsert official AP Government holidays into academic_calendar.

    Returns count of records upserted.
    """
    if year == 2026:
        all_holidays = AP_2026_GENERAL_HOLIDAYS + AP_2026_OPTIONAL_HOLIDAYS
    else:
        # No built-in data for other years
        return 0

    count = 0
    for h in all_holidays:
        is_general = h["category"] == HolidayCategory.PUBLIC_HOLIDAY

        existing = db.query(AcademicCalendar).filter(
            AcademicCalendar.date == h["date"],
            AcademicCalendar.holiday_source == HolidaySource.AP_GOVERNMENT.value,
        ).first()

        if existing:
            existing.name = h["name"]
            existing.normalized_name = _normalize_name(h["name"])
            existing.holiday_category = h["category"].value
            existing.is_public_holiday = is_general
            existing.is_default_no_college = is_general
            existing.source_priority = 100
            existing.is_active = True
            existing.last_synced_at = datetime.now(timezone.utc)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(AcademicCalendar(
                date=h["date"],
                name=h["name"],
                normalized_name=_normalize_name(h["name"]),
                calendar_year=year,
                state_code="IN-AP",
                holiday_category=h["category"].value,
                holiday_source=HolidaySource.AP_GOVERNMENT.value,
                source_priority=100,
                is_public_holiday=is_general,
                is_default_no_college=is_general,
                description=f"Official AP Government holiday ({'General' if is_general else 'Optional'})",
                last_synced_at=datetime.now(timezone.utc),
                is_active=True,
            ))
        count += 1

    db.commit()
    return count
