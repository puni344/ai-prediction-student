"""Pydantic schemas for Student Study Timetable, Holidays, and Calendar Settings."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CalendarBusyEventSchema(BaseModel):
    """Represents a busy calendar event retrieved from Google Calendar."""
    title: str = Field(..., description="Event title or summary")
    start_time: str = Field(..., description="Start time in HH:MM format")
    end_time: str = Field(..., description="End time in HH:MM format")
    is_all_day: bool = Field(False, description="True if this is an all-day event")
    is_holiday_suggestion: bool = Field(False, description="True if event suggests a college holiday")


class HolidayToggleRequest(BaseModel):
    """Request payload to mark or unmark a date as a holiday."""
    date: str = Field(..., description="Target date in YYYY-MM-DD format")
    is_holiday: bool = Field(..., description="True to mark as holiday, False to unmark")
    label: Optional[str] = Field("College Holiday", description="Label for holiday")


class HolidayResponse(BaseModel):
    """Response representing a saved holiday."""
    date: str
    label: str


class DayStatusResponse(BaseModel):
    """Dynamic status of current or selected day."""
    current_date: str
    current_time: str
    selected_date: str
    day_of_week: str
    timezone: str = "Asia/Kolkata"
    is_sunday: bool
    is_holiday: bool
    holiday_label: Optional[str] = None
    college_active: bool
    prediction_is_stale: bool = False
    prediction_stale_reason: Optional[str] = None
    calendar_connected: bool = False
    calendar_events: List[CalendarBusyEventSchema] = []


class TimetablePreferencesSchema(BaseModel):
    """Configuration preferences for daily student study timetable."""
    college_start: str = Field("09:00", description="College start time in HH:MM (24h)")
    college_end: str = Field("16:00", description="College end time in HH:MM (24h)")
    daily_study_hours: float = Field(2.0, ge=0.5, le=16.0, description="Target study hours per day")
    sleep_hours: float = Field(8.0, ge=4.0, le=14.0, description="Daily sleep duration in hours")
    sleep_start: str = Field("23:00", description="Sleep start time in HH:MM (24h)")
    sleep_end: str = Field("07:00", description="Wake-up time in HH:MM (24h)")
    rest_minutes: int = Field(15, ge=5, le=60, description="Rest break between study sessions")
    meal_minutes: int = Field(30, ge=15, le=90, description="Duration per meal")
    breakfast_start: str = Field("08:00", description="Breakfast start time in HH:MM (24h)")
    breakfast_duration: int = Field(30, ge=10, le=120, description="Breakfast duration in minutes")
    lunch_start: str = Field("12:00", description="Lunch start time in HH:MM (24h)")
    lunch_duration: int = Field(60, ge=10, le=120, description="Lunch duration in minutes")
    dinner_start: str = Field("20:00", description="Dinner start time in HH:MM (24h)")
    dinner_duration: int = Field(30, ge=10, le=120, description="Dinner duration in minutes")
    break_reserve_minutes: int = Field(120, ge=0, le=480, description="Reserved break/downtime minutes per day")
    preferred_study_period: str = Field("evening", description="morning, afternoon, evening, night, flexible")
    session_length_preference: str = Field("standard", description="standard (45m), pomodoro (25m), deep_work (55m)")
    sleep_is_fixed: bool = Field(False, description="True if sleep schedule is explicitly fixed by user, False if flexible")
    min_sleep_hours: Optional[float] = Field(None, ge=4.0, le=14.0, description="Minimum sleep duration in hours (flexible mode)")
    max_sleep_hours: Optional[float] = Field(None, ge=4.0, le=14.0, description="Maximum sleep duration in hours (flexible mode)")
    min_study_hours: Optional[float] = Field(None, ge=0.5, le=16.0, description="Minimum target study hours per day (flexible mode)")
    max_study_hours: Optional[float] = Field(None, ge=0.5, le=16.0, description="Maximum target study hours per day (flexible mode)")

    # Date-aware & Holiday fields
    selected_date: Optional[str] = Field(None, description="Date being planned (YYYY-MM-DD); defaults to today")
    is_holiday: Optional[bool] = Field(None, description="Explicit holiday override for selected_date")
    holiday_label: Optional[str] = Field(None, description="Label if marked holiday")
    calendar_events: Optional[List[CalendarBusyEventSchema]] = Field(default=[], description="Calendar busy events")

    # Extension fields for future weekly planner
    day_of_week: Optional[str] = Field(None, description="Day of week (Monday..Sunday)")
    is_enabled: Optional[bool] = Field(True, description="Whether this day schedule is enabled")
    custom_day_preferences: Optional[Dict[str, Any]] = Field(None, description="Day-specific overrides")

    # Mirror profile indicators for validation & display
    profile_study_hours: Optional[float] = Field(None, description="Authoritative profile study hours")
    profile_sleep_hours: Optional[float] = Field(None, description="Authoritative profile sleep hours")

    model_config = ConfigDict(from_attributes=True)


class TimetableBlockSchema(BaseModel):
    """A scheduled block within the 24-hour day."""
    start_time: str
    end_time: str
    activity: str
    category: str  # sleep, college, study, rest, meal, routine, calendar
    duration_minutes: int
    focus_area: Optional[str] = None


class TimetableValidationResult(BaseModel):
    """Result of real-time 24-hour capacity and overlap validation."""
    valid: bool
    errorCode: Optional[str] = None
    error_code: Optional[str] = None
    error_type: Optional[str] = None  # HARD_CONSTRAINT_CONFLICT, CAPACITY_INFEASIBILITY
    message: str
    required_study_minutes: int = 0
    shortfall_minutes: int = 0
    is_partial_preview: bool = False
    hard_occupied_minutes: int = 0
    break_reserve_minutes: int = 120
    remaining_flexible_minutes: int = 0
    min_allowable_sleep_hours: float = 6.0
    max_allowable_sleep_hours: float = 10.0
    min_allowable_study_hours: float = 1.0
    max_allowable_study_hours: float = 16.0
    college_active: bool = True
    collegeMinutes: int = 0
    college_minutes: int = 0
    sleepMinutes: int = 0
    sleep_minutes: int = 0
    mealMinutes: int = 0
    meal_minutes: int = 0
    restMinutes: int = 0
    rest_minutes: int = 0
    calendarBusyMinutes: int = 0
    calendar_busy_minutes: int = 0
    availableMinutes: int = 0
    available_minutes: int = 0
    availableStudyMinutes: int = 0
    available_study_minutes: int = 0
    requestedStudyMinutes: int = 0
    requested_study_minutes: int = 0
    totalMinutes: int = 0
    total_requested_minutes: int = 0
    remainingBufferMinutes: int = 0
    remaining_buffer_minutes: int = 0
    wakeTime: str = "07:00"
    wake_time: str = "07:00"
    is_sunday: bool = False
    is_holiday: bool = False
    selected_date: Optional[str] = None


class TimetableResponse(BaseModel):
    """Complete generated 24-hour study timetable response."""
    preferences: TimetablePreferencesSchema
    validation: TimetableValidationResult
    summary: Dict[str, Any]
    schedule: List[TimetableBlockSchema]
    is_partial_preview: bool = False
    infeasibility_reason: Optional[str] = None
