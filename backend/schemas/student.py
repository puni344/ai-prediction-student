"""Student profile request and response schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class StudentProfileResponse(BaseModel):
    id: int
    user_id: int
    roll_number: Optional[str] = None
    program: Optional[str] = None
    department: Optional[str] = None
    academic_year: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    attendance: float = 0.0
    study_hours: float = 0.0
    sleep_hours: float = 0.0
    assignments_completed: float = 0.0
    previous_grade: float = 0.0
    parent_education: Optional[str] = None
    internet_access: Optional[str] = None
    family_income: Optional[str] = None
    extra_classes: Optional[str] = None
    participation: float = 0.0
    college_start: Optional[str] = None
    college_end: Optional[str] = None
    breakfast_start: Optional[str] = None
    breakfast_duration: Optional[int] = Field(None, ge=10, le=120)
    lunch_start: Optional[str] = None
    lunch_duration: Optional[int] = Field(None, ge=10, le=120)
    dinner_start: Optional[str] = None
    dinner_duration: Optional[int] = Field(None, ge=10, le=120)
    break_reserve_minutes: Optional[int] = Field(None, ge=0, le=480)
    breakfast_start: Optional[str] = "08:00"
    breakfast_duration: Optional[int] = 30
    lunch_start: Optional[str] = "13:00"
    lunch_duration: Optional[int] = 30
    dinner_start: Optional[str] = "20:00"
    dinner_duration: Optional[int] = 30
    break_reserve_minutes: Optional[int] = 120
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StudentProfileUpdate(BaseModel):
    roll_number: Optional[str] = None
    program: Optional[str] = None
    department: Optional[str] = None
    academic_year: Optional[str] = None
    age: Optional[int] = Field(None, ge=10, le=25)
    gender: Optional[str] = None
    attendance: Optional[float] = Field(None, ge=0.0, le=100.0)
    study_hours: Optional[float] = Field(None, ge=0.0, le=16.0)
    sleep_hours: Optional[float] = Field(None, ge=0.0, le=14.0)
    assignments_completed: Optional[float] = Field(None, ge=0.0, le=100.0)
    previous_grade: Optional[float] = Field(None, ge=0.0, le=100.0)
    parent_education: Optional[str] = None
    internet_access: Optional[str] = None
    family_income: Optional[str] = None
    extra_classes: Optional[str] = None
    participation: Optional[float] = Field(None, ge=0.0, le=100.0)
    college_start: Optional[str] = None
    college_end: Optional[str] = None
    breakfast_start: Optional[str] = None
    breakfast_duration: Optional[int] = Field(None, ge=10, le=120)
    lunch_start: Optional[str] = None
    lunch_duration: Optional[int] = Field(None, ge=10, le=120)
    dinner_start: Optional[str] = None
    dinner_duration: Optional[int] = Field(None, ge=10, le=120)
    break_reserve_minutes: Optional[int] = Field(None, ge=0, le=480)
