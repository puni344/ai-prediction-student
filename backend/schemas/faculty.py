"""Faculty request and response schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from backend.schemas.student import StudentProfileResponse
from backend.schemas.prediction import PredictionResponse


class FacultyDashboardResponse(BaseModel):
    total_enrolled_students: int
    students_with_predictions: int
    high_risk_count: int
    moderate_risk_count: int
    low_risk_count: int
    average_predicted_score: Optional[float] = None
    average_pass_probability: Optional[float] = None
    assigned_departments: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class FacultyStudentItem(BaseModel):
    id: int  # student_profiles.id
    user_id: int
    full_name: str
    email: str
    roll_number: Optional[str] = None
    department: Optional[str] = None
    academic_year: Optional[str] = None
    attendance: float
    study_hours: float
    latest_predicted_score: Optional[float] = None
    latest_pass_fail: Optional[str] = None
    latest_pass_probability: Optional[float] = None
    latest_risk_level: Optional[str] = None
    latest_risk_index: Optional[float] = None
    last_prediction_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FacultyStudentListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    students: List[FacultyStudentItem]

    model_config = ConfigDict(from_attributes=True)


class FacultyStudentDetailResponse(BaseModel):
    profile: StudentProfileResponse
    full_name: str
    email: str
    latest_prediction: Optional[PredictionResponse] = None
    prediction_history: List[PredictionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ScatterPoint(BaseModel):
    x: float
    y: float
    name: str
    risk_level: str

    model_config = ConfigDict(from_attributes=True)


class FacultyAnalyticsResponse(BaseModel):
    total_predictions: int
    average_predicted_score: Optional[float] = None
    average_pass_probability: Optional[float] = None
    risk_distribution: Dict[str, int]
    score_distribution: Dict[str, int]
    attendance_vs_score: List[ScatterPoint]
    study_hours_vs_score: List[ScatterPoint]
    assignments_vs_score: List[ScatterPoint]
    correlations: Dict[str, Optional[float]] = {}
    assigned_departments: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class FacultyRiskItem(BaseModel):
    student_id: int
    full_name: str
    roll_number: Optional[str] = None
    department: Optional[str] = None
    risk_level: str
    risk_index: float
    risk_description: str
    predicted_score: float
    pass_fail: str
    pass_probability: float
    attendance: float
    study_hours: float
    last_prediction_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FacultyRiskResponse(BaseModel):
    total_flagged: int
    high_risk_count: int
    moderate_risk_count: int
    students: List[FacultyRiskItem]
    assigned_departments: List[str] = []

    model_config = ConfigDict(from_attributes=True)
