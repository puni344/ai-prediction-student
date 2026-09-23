"""Calendar Sync Service for Academic Calendar.

Integrates Calendarific v2 as the supporting external holiday data provider.
AP Government data has higher priority (source_priority=100) than Calendarific (50).

Key Requirements:
- Single Calendarific API key used across all years (2025, 2026, 2027, etc.)
- Strict caching by (country, location, year) to conserve free tier quota (500 req/month)
- Never overwrites verified AP Government entries
- Festivals / Observances do NOT automatically close college
- Startup sync checks cache before calling external API
- Calendar sync NEVER triggers ML predictions, snapshots, or risk updates
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from backend.services.academic_calendar.calendar_models import (
    AcademicCalendar,
    HolidayCategory,
    HolidaySource,
)
from backend.services.academic_calendar.calendarific_client import CalendarificClient
from backend.services.academic_calendar.ap_government_calendar import (
    seed_ap_government_holidays,
    _normalize_name,
)

logger = logging.getLogger(__name__)


def is_year_cached(db: Session, year: int, source: Optional[str] = None) -> bool:
    """Check if we have cached calendar data for a given year."""
    query = db.query(AcademicCalendar).filter(
        AcademicCalendar.calendar_year == year,
        AcademicCalendar.is_active == True,
    )
    if source:
        query = query.filter(AcademicCalendar.holiday_source == source)
    return query.count() > 0


def sync_calendarific_data(
    db: Session,
    client: CalendarificClient,
    year: int,
) -> Dict[str, Any]:
    """Sync holidays from Calendarific v2 for a given year.

    Never overwrites AP_GOVERNMENT source entries.
    Returns summary of imported, updated, and unchanged records.
    """
    if not client.is_configured:
        logger.info("Calendarific client not configured. Skipping external fetch for %d.", year)
        return {"status": "skipped", "imported": 0, "updated": 0, "unchanged": 0, "message": "Calendarific API key not configured"}

    holidays = client.get_holidays(year)
    if holidays is None:
        logger.warning("Calendarific returned no data or error for year %d. Falling back to local/cached data.", year)
        return {"status": "unavailable", "imported": 0, "updated": 0, "unchanged": 0, "message": "Calendarific unavailable; using cached/local data"}

    imported_count = 0
    updated_count = 0
    unchanged_count = 0
    staged_entries = {}

    for h in holidays:
        date_str = h.get("date", "")
        if not date_str:
            continue

        name = h.get("name", "Unknown Holiday")
        category_str = h.get("category", "OBSERVANCE")
        is_public = h.get("is_public_holiday", False)
        is_default_no_college = h.get("is_default_no_college", False)
        desc = h.get("description", "")

        # 1. Never overwrite verified AP Government data
        existing_ap = db.query(AcademicCalendar).filter(
            AcademicCalendar.date == date_str,
            AcademicCalendar.holiday_source == HolidaySource.AP_GOVERNMENT.value,
        ).first()

        if existing_ap:
            # AP Government is authoritative; skip overwriting
            unchanged_count += 1
            continue

        # 2. Check in-memory batch staged entries first to avoid unique constraint violations
        existing_cal = staged_entries.get(date_str)

        if not existing_cal:
            existing_cal = db.query(AcademicCalendar).filter(
                AcademicCalendar.date == date_str,
                AcademicCalendar.holiday_source == HolidaySource.CALENDARIFIC.value,
            ).first()

        # Also check legacy HOLIDAY_API entries to migrate them
        if not existing_cal:
            existing_cal = db.query(AcademicCalendar).filter(
                AcademicCalendar.date == date_str,
                AcademicCalendar.holiday_source == "HOLIDAY_API",
            ).first()

        if existing_cal:
            changed = False
            # If multiple holidays on same date, prefer higher classification
            category_priority = {
                "PUBLIC_HOLIDAY": 4,
                "OPTIONAL_HOLIDAY": 3,
                "FESTIVAL": 2,
                "OBSERVANCE": 1,
            }
            curr_pri = category_priority.get(existing_cal.holiday_category, 0)
            new_pri = category_priority.get(category_str, 0)

            if new_pri > curr_pri:
                existing_cal.holiday_category = category_str
                existing_cal.is_public_holiday = is_public
                existing_cal.is_default_no_college = is_default_no_college
                changed = True

            if name not in existing_cal.name:
                existing_cal.name = f"{existing_cal.name} / {name}"
                existing_cal.normalized_name = _normalize_name(existing_cal.name)
                changed = True

            if existing_cal.holiday_source != HolidaySource.CALENDARIFIC.value:
                existing_cal.holiday_source = HolidaySource.CALENDARIFIC.value
                changed = True

            if desc and not existing_cal.description:
                existing_cal.description = desc
                changed = True

            existing_cal.last_synced_at = datetime.now(timezone.utc)
            existing_cal.updated_at = datetime.now(timezone.utc)
            staged_entries[date_str] = existing_cal

            if changed:
                updated_count += 1
            else:
                unchanged_count += 1
        else:
            new_entry = AcademicCalendar(
                date=date_str,
                name=name,
                normalized_name=_normalize_name(name),
                calendar_year=year,
                state_code="in-ap",
                holiday_category=category_str,
                holiday_source=HolidaySource.CALENDARIFIC.value,
                source_priority=50,
                is_public_holiday=is_public,
                is_default_no_college=is_default_no_college,
                description=desc,
                last_synced_at=datetime.now(timezone.utc),
                is_active=True,
            )
            db.add(new_entry)
            staged_entries[date_str] = new_entry
            imported_count += 1

    db.commit()
    logger.info(
        "Calendarific sync for year %d: imported=%d, updated=%d, unchanged=%d",
        year, imported_count, updated_count, unchanged_count,
    )
    return {
        "status": "success",
        "imported": imported_count,
        "updated": updated_count,
        "unchanged": unchanged_count,
        "total_processed": len(holidays),
        "message": f"Calendarific sync completed: {imported_count} imported, {updated_count} updated, {unchanged_count} unchanged",
    }


def sync_calendar_for_year(
    db: Session,
    client: CalendarificClient,
    year: int,
    force: bool = False,
) -> Dict[str, Any]:
    """Full calendar sync for a year:
    1. Seed official AP Government holidays (source_priority=100)
    2. If force or not cached in Calendarific, fetch from Calendarific
    3. Return consolidated sync result
    """
    result = {
        "year": year,
        "ap_government": 0,
        "calendarific": {"status": "skipped", "imported": 0, "updated": 0, "unchanged": 0},
        "status": "success",
        "message": "",
    }

    # 1. Seed official AP Government holidays
    try:
        ap_count = seed_ap_government_holidays(db, year)
        result["ap_government"] = ap_count
        logger.info("Seeded %d AP Government holidays for year %d", ap_count, year)
    except Exception as e:
        logger.error("Failed to seed AP Government holidays: %s", str(e))
        result["status"] = "partial_failure"

    # 2. Enrich with Calendarific (respecting caching)
    if not force and is_year_cached(db, year, source=HolidaySource.CALENDARIFIC.value):
        cached_count = db.query(AcademicCalendar).filter(
            AcademicCalendar.calendar_year == year,
            AcademicCalendar.holiday_source == HolidaySource.CALENDARIFIC.value,
        ).count()
        logger.info("Calendarific data for year %d is already cached (%d entries). Using cache.", year, cached_count)
        result["calendarific"] = {
            "status": "cached",
            "imported": 0,
            "updated": 0,
            "unchanged": cached_count,
            "message": f"Using cached Calendarific data ({cached_count} entries)",
        }
        result["message"] = f"Year {year} loaded from local database cache ({cached_count} entries)."
    else:
        cal_res = sync_calendarific_data(db, client, year)
        result["calendarific"] = cal_res
        result["message"] = cal_res.get("message", "Sync complete")

    return result


def startup_sync(db: Session, client: CalendarificClient, current_year: int) -> Dict[int, Any]:
    """Run on application startup:
    Ensure previous year, current year, and next year (e.g. 2025, 2026, 2027)
    are seeded with official data and cached Calendarific data.
    Does NOT repeatedly hit external API if already cached in SQLite.
    """
    results = {}
    years_to_check = [current_year - 1, current_year, current_year + 1]

    for y in years_to_check:
        # Seed AP Gov holidays if missing
        seed_ap_government_holidays(db, y)
        if not is_year_cached(db, y, source=HolidaySource.CALENDARIFIC.value):
            logger.info("Year %d not in Calendarific cache. Syncing...", y)
            results[y] = sync_calendar_for_year(db, client, y, force=False)
        else:
            count = db.query(AcademicCalendar).filter(AcademicCalendar.calendar_year == y).count()
            logger.info("Year %d already cached (%d total entries).", y, count)
            results[y] = {"year": y, "status": "cached", "total_entries": count}

    return results
