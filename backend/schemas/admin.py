"""Main Administrator request and response schemas."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from backend.schemas.student import StudentProfileResponse
from backend.schemas.prediction import PredictionResponse


class AdminOverviewResponse(BaseModel):
    total_students: int
    total_faculty: int
    total_predictions: int
    risk_distribution: Dict[str, int]
    average_predicted_score: Optional[float] = None
    average_pass_probability: Optional[float] = None
    students_by_department: List[Dict[str, Any]]
    faculty_by_department: List[Dict[str, Any]]
    department_performance: List[Dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)


class AdminStudentItem(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    roll_number: Optional[str] = None
    department: Optional[str] = None
    academic_year: Optional[str] = None
    program: Optional[str] = None
    attendance: float
    study_hours: float
    latest_predicted_score: Optional[float] = None
    latest_pass_fail: Optional[str] = None
    latest_pass_probability: Optional[float] = None
    latest_risk_level: Optional[str] = None
    latest_risk_index: Optional[float] = None
    last_prediction_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminStudentListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    students: List[AdminStudentItem]

    model_config = ConfigDict(from_attributes=True)


class AdminFacultyItem(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    faculty_id: Optional[str] = None
    designation: str
    department: str
    assigned_departments: List[str]
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminFacultyListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    faculty: List[AdminFacultyItem]

    model_config = ConfigDict(from_attributes=True)
