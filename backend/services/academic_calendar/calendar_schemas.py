"""Pydantic schemas for Academic Calendar and Timetable Simulation."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DayResolutionResponse(BaseModel):
    """Full resolved day status for frontend."""
    date: str
    day_of_week: str
    holiday: bool = False
    holiday_name: Optional[str] = None
    holiday_source: Optional[str] = None
    holiday_category: Optional[str] = None
    is_optional_holiday: bool = False
    default_college: bool = True
    student_override: bool = False
    student_override_reason: Optional[str] = None
    admin_override: bool = False
    admin_override_reason: Optional[str] = None
    college_status: bool = True
    final_status: str = "COLLEGE_DAY"
    locked: bool = False
    override_scope: Optional[str] = None


class CalendarEntryResponse(BaseModel):
    """Single calendar entry in month/year views."""
    date: str
    name: str
    category: str
    source: str
    is_public_holiday: bool = True
    is_default_no_college: bool = True
    description: Optional[str] = None
    locked: bool = False
    admin_override: bool = False


class CalendarMonthResponse(BaseModel):
    """Month view with resolved day statuses."""
    year: int
    month: int
    days: List[DayResolutionResponse]


class CalendarYearResponse(BaseModel):
    """Full year academic calendar entries."""
    year: int
    entries: List[CalendarEntryResponse]
    total_public_holidays: int = 0
    total_optional_holidays: int = 0


class StudentOverrideRequest(BaseModel):
    """Request to create/update a student calendar override."""
    college_status: bool = Field(..., description="True = student has college, False = holiday")
    reason: Optional[str] = Field(None, description="Reason for the override")


class StudentOverrideResponse(BaseModel):
    """Response after creating/updating a student override."""
    date: str
    override_type: str
    college_status: bool
    reason: Optional[str] = None
    message: str


class AdminOverrideRequest(BaseModel):
    """Request to create/update an admin calendar override."""
    college_status: bool = Field(..., description="True = institution has college, False = closed")
    reason: Optional[str] = Field(None, description="Reason for the override")


class AdminOverrideResponse(BaseModel):
    """Response after creating/updating an admin override."""
    date: str
    override_type: str
    college_status: bool
    reason: Optional[str] = None
    created_by: Optional[str] = None
    message: str


class AdminCalendarEntry(BaseModel):
    """Calendar entry for admin management view."""
    date: str
    name: str
    category: str
    source: str
    is_public_holiday: bool
    is_default_no_college: bool
    student_override_count: int = 0
    admin_override: Optional[Dict[str, Any]] = None


class TimetableSimulationRequest(BaseModel):
    """Request for live timetable simulation (no ML snapshot)."""
    date: str = Field(..., description="Target date YYYY-MM-DD")
    college_start: str = Field("09:00", description="College start HH:MM")
    college_end: str = Field("16:00", description="College end HH:MM")
    study_hours: float = Field(2.0, ge=0.0, le=16.0, description="Target study hours")
    sleep_hours: float = Field(8.0, ge=4.0, le=14.0, description="Sleep duration hours")
    sleep_start: str = Field("23:00", description="Sleep start HH:MM")
    meal_count: int = Field(3, ge=1, le=5, description="Number of meals")
    meal_duration_minutes: int = Field(40, ge=15, le=90, description="Duration per meal")
    rest_break_count: int = Field(3, ge=0, le=10, description="Number of rest breaks")
    rest_break_duration_minutes: int = Field(15, ge=5, le=60, description="Duration per rest break")
    preferred_study_period: str = Field("evening", description="morning|afternoon|evening|night|flexible")


class TimetableCapacity(BaseModel):
    """Capacity analysis for timetable simulation."""
    available_hours: float
    requested_study_hours: float
    remaining_buffer_hours: float
    max_feasible_study_hours: float
    college_hours: float = 0.0
    sleep_hours: float = 0.0
    meal_hours: float = 0.0
    rest_hours: float = 0.0


class TimetableTimelineBlock(BaseModel):
    """A scheduled block in the 24-hour timeline."""
    start_time: str
    end_time: str
    activity: str
    category: str  # sleep, college, study, rest, meal
    duration_minutes: int
    focus_area: Optional[str] = None


class TimetableConflict(BaseModel):
    """A detected conflict in the timetable."""
    type: str
    message: str
    blocks_involved: List[str] = []


class TimetableSimulationResponse(BaseModel):
    """Response from timetable simulation."""
    feasible: bool
    date: str
    day_status: DayResolutionResponse
    capacity: TimetableCapacity
    conflicts: List[TimetableConflict] = []
    timeline: List[TimetableTimelineBlock] = []
    feasibility_message: str = ""
    valid_study_options: List[float] = []


class TimetableSaveRequest(BaseModel):
    """Request to save a finalized daily timetable."""
    simulation: TimetableSimulationRequest


class TimetableSaveResponse(BaseModel):
    """Response after saving a timetable."""
    saved: bool
    date: str
    message: str
