"""Prediction request and response schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class PredictionSimulationRequest(BaseModel):
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


class PredictionResponse(BaseModel):
    id: Optional[int] = None
    predicted_score: float
    pass_fail: str
    pass_probability: float
    confidence_score: float
    risk_level: str
    risk_index: float
    risk_description: str
    base_value: float
    shap_consistency: bool
    top_positive: List[Dict[str, Any]] = []
    top_negative: List[Dict[str, Any]] = []
    model_comparison: Dict[str, Dict[str, Any]] = {}
    is_stale: bool = False
    stale_reason: Optional[str] = None
    performance_model: Optional[str] = None
    pass_fail_model: Optional[str] = None
    is_what_if_preview: bool = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DailySnapshotResponse(BaseModel):
    id: int
    student_id: int
    snapshot_date: str
    snapshot_time: str
    timezone: str
    study_hours: float
    attendance: float
    sleep_hours: float
    assignments_completed: float
    participation: float
    previous_grade: float
    predicted_score: float
    pass_probability: float
    risk_level: str
    risk_index: float
    risk_description: Optional[str] = None
    shap_data: Dict[str, Any] = {}
    recommendation_data: Dict[str, Any] = {}
    created_at: datetime
    is_official_snapshot: bool = True

    model_config = ConfigDict(from_attributes=True)


class SnapshotTrendResponse(BaseModel):
    view_type: str
    total_days: int
    avg_predicted_score: float
    risk_distribution: Dict[str, int]
    study_hours_trend: List[Dict[str, Any]]
    attendance_trend: List[Dict[str, Any]]
    risk_transitions: Optional[List[Dict[str, Any]]] = None
    high_risk_days_count: Optional[int] = None
    improvement_pattern: Optional[str] = None
    starting_predicted_score: Optional[float] = None
    latest_predicted_score: Optional[float] = None
    score_change: Optional[float] = None
    study_consistency: Optional[str] = None
    snapshots: List[DailySnapshotResponse] = []
    bucket_trends: Optional[List[Dict[str, Any]]] = None
    formula_definitions: Optional[Dict[str, str]] = None
    data_sufficiency: Optional[Dict[str, Any]] = None
