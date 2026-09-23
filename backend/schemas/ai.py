"""Pydantic schemas for AI recommendations, study planner, and chat."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# =====================================================================
# 1. LLM Output Schemas (Strictly Natural Language - NO Numbers/Times)
# =====================================================================
class LLMRecommendationLanguage(BaseModel):
    id: str = Field(..., description="Candidate ID matching deterministic engine (e.g. rec_study_hours)")
    title: str = Field(..., description="Actionable recommendation title")
    reason: str = Field(..., description="Plain-language explanation of why this driver matters")
    action: str = Field(..., description="Concrete study behavior change or exercise")


class LLMRecommendationBatch(BaseModel):
    summary: str = Field(..., description="Executive narrative summary of student standing")
    recommendations: List[LLMRecommendationLanguage] = Field(
        ..., description="Language items matching candidate IDs"
    )


# =====================================================================
# 2. Deterministic Planner & Recommendation Schemas
# =====================================================================
class StudyPlanBlock(BaseModel):
    start_time: str = Field(..., description="HH:MM formatted start time (e.g., '16:00')")
    end_time: str = Field(..., description="HH:MM formatted end time (e.g., '16:45')")
    activity: str = Field(..., description="Specific study action or break")
    focus_area: str = Field(..., description="Academic metric addressed")
    duration_minutes: int = Field(..., description="Duration in minutes")
    is_break: bool = Field(default=False, description="Whether this block represents rest/break")

    model_config = ConfigDict(from_attributes=True)


class StudyPlanConstraints(BaseModel):
    available_minutes: int = Field(default=120, ge=30, le=480, description="Total minutes available to study")
    preferred_start_time: str = Field(default="18:00", description="Preferred start time (HH:MM)")
    max_session_minutes: int = Field(default=45, ge=20, le=90, description="Maximum uninterrupted focus block")
    break_minutes: int = Field(default=10, ge=5, le=30, description="Break duration between blocks")


class RecommendationItem(BaseModel):
    id: str
    title: str
    reason: str
    action: str
    priority: str  # "high", "medium", "low"
    priority_score: float  # [0, 100]
    duration_minutes: int
    source_factors: List[str]

    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# 3. Composed API Response Schemas
# =====================================================================
class RecommendationResponse(BaseModel):
    generated_at: datetime
    prediction_context: Dict[str, Any]  # Verified ML values: score, prob, risk, risk_index
    overall_priority_score: float  # Mean composite priority score of top-selected interventions
    summary: str  # LLM generated or fallback
    recommendations: List[RecommendationItem]  # Deterministic metrics + LLM language
    study_plan: List[StudyPlanBlock]  # Deterministic planner schedule
    source_factors: List[str]  # Derived from verified backend data
    ai_enhanced: bool = True
    ai_status: str = "development_mock"  # "live_provider" | "development_mock" | "deterministic_fallback" | "unavailable"

    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# 4. Chat Schemas
# =====================================================================
class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(default="Academic Advisory Session", max_length=255)


class ChatSessionResponse(BaseModel):
    id: int
    student_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000, description="Student question or statement")
    session_id: Optional[int] = Field(default=None, description="Existing session ID, or None for auto-create")


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: str  # "user", "assistant"
    content: str
    context_used: List[str] = Field(default_factory=list)
    created_at: datetime
    capability_used: Optional[str] = Field(default="GENERAL_CHAT", description="Deterministic or AI capability used")
    ai_status: Optional[str] = Field(default="live_gemini", description="AI provider status: live_gemini | deterministic_fallback | development_mock")

    model_config = ConfigDict(from_attributes=True)
