"""Google Calendar Read-Only Integration Layer for Timetable Planning.

Purpose:
- Retrieve user's calendar events for the selected date.
- Identify occupied / busy periods to schedule study sessions around.
- Identify all-day events / holiday suggestions.
- Enforce strict read-only scope: https://www.googleapis.com/auth/calendar.readonly
- Never create, update, or delete calendar events.
- Never send calendar information to Gemini.
"""
import json
import logging
from datetime import datetime, date, time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.timetable import StudentCalendarSetting
from backend.schemas.timetable import CalendarBusyEventSchema
from backend.services.date_service import get_timezone, get_day_info

logger = logging.getLogger(__name__)

# Minimum appropriate read-only calendar scope
GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"


def get_calendar_events_for_date(
    student_id: int,
    date_str: str,
    db: Session,
    tz_name: str = "Asia/Kolkata",
) -> List[CalendarBusyEventSchema]:
    """Retrieve calendar events for a student on a specific date.

    Supports both connected Google Calendar settings and mock/demo events.
    Returns list of CalendarBusyEventSchema.
    """
    setting = db.query(StudentCalendarSetting).filter(
        StudentCalendarSetting.student_id == student_id
    ).first()

    if not setting or not setting.is_connected:
        return []

    # If mock/stored events exist in the setting, parse them
    events: List[CalendarBusyEventSchema] = []
    if setting.mock_events_json:
        try:
            raw_list = json.loads(setting.mock_events_json)
            for item in raw_list:
                item_date = item.get("date", date_str)
                if item_date == date_str:
                    events.append(
                        CalendarBusyEventSchema(
                            title=item.get("title", "Busy Period"),
                            start_time=item.get("start_time", "14:00"),
                            end_time=item.get("end_time", "15:00"),
                            is_all_day=item.get("is_all_day", False),
                            is_holiday_suggestion=item.get("is_holiday_suggestion", False),
                        )
                    )
        except Exception as e:
            logger.warning(f"Error parsing mock calendar events: {e}")

    # If live Google Calendar access token is available and googleapiclient is available
    if setting.access_token:
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            creds = Credentials(
                token=setting.access_token,
                scopes=[GOOGLE_CALENDAR_READONLY_SCOPE],
            )
            service = build("calendar", "v3", credentials=creds)

            # Query events for the target date in local timezone
            tz = get_timezone(tz_name)
            dt_start = datetime.strptime(f"{date_str} 00:00:00", "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz)
            dt_end = datetime.strptime(f"{date_str} 23:59:59", "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz)

            calendar_id = setting.calendar_id or "primary"
            events_result = service.events().list(
                calendarId=calendar_id,
                timeMin=dt_start.isoformat(),
                timeMax=dt_end.isoformat(),
                singleEvents=True,
                orderBy="startTime",
            ).execute()

            items = events_result.get("items", [])
            for item in items:
                summary = item.get("summary", "Busy Period")
                start_raw = item.get("start", {})
                end_raw = item.get("end", {})

                # Check if all-day
                if "date" in start_raw and "dateTime" not in start_raw:
                    is_holiday_sugg = any(
                        w in summary.lower()
                        for w in ["holiday", "festival", "vacation", "recess", "break", "leave"]
                    )
                    events.append(
                        CalendarBusyEventSchema(
                            title=summary,
                            start_time="00:00",
                            end_time="23:59",
                            is_all_day=True,
                            is_holiday_suggestion=is_holiday_sugg,
                        )
                    )
                else:
                    # Timed event
                    st_dt = datetime.fromisoformat(start_raw.get("dateTime").replace("Z", "+00:00")).astimezone(tz)
                    et_dt = datetime.fromisoformat(end_raw.get("dateTime").replace("Z", "+00:00")).astimezone(tz)
                    events.append(
                        CalendarBusyEventSchema(
                            title=summary,
                            start_time=st_dt.strftime("%H:%M"),
                            end_time=et_dt.strftime("%H:%M"),
                            is_all_day=False,
                            is_holiday_suggestion=False,
                        )
                    )
        except Exception as e:
            logger.warning(f"Error fetching live Google Calendar events: {e}")

    return events


def connect_student_calendar(
    student_id: int,
    db: Session,
    access_token: Optional[str] = None,
    calendar_email: Optional[str] = None,
    mock_events: Optional[List[Dict[str, Any]]] = None,
) -> StudentCalendarSetting:
    """Connect student calendar (or configure demo/mock calendar)."""
    setting = db.query(StudentCalendarSetting).filter(
        StudentCalendarSetting.student_id == student_id
    ).first()

    if not setting:
        setting = StudentCalendarSetting(
            student_id=student_id,
            is_connected=True,
            calendar_email=calendar_email or "student@university.edu",
            access_token=access_token,
            mock_events_json=json.dumps(mock_events or []),
        )
        db.add(setting)
    else:
        setting.is_connected = True
        if access_token:
            setting.access_token = access_token
        if calendar_email:
            setting.calendar_email = calendar_email
        if mock_events is not None:
            setting.mock_events_json = json.dumps(mock_events)

    db.commit()
    db.refresh(setting)
    return setting


def disconnect_student_calendar(student_id: int, db: Session) -> bool:
    """Disconnect Google Calendar for student."""
    setting = db.query(StudentCalendarSetting).filter(
        StudentCalendarSetting.student_id == student_id
    ).first()
    if setting:
        setting.is_connected = False
        setting.access_token = None
        db.commit()
        return True
    return False
