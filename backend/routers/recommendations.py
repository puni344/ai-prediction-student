"""API Router for AI Recommendations and Study Planner."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.security import get_current_user
from backend.schemas.ai import RecommendationResponse, StudyPlanConstraints
from backend.services.recommendation_service import generate_recommendations_for_student

router = APIRouter(prefix="/recommendations", tags=["AI Recommendations"])


@router.post("/generate", response_model=RecommendationResponse)
def generate_recommendations(
    constraints: StudyPlanConstraints = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate personalized academic recommendations and deterministic study schedule.
    
    Student-only access. Merges verified ML metrics + deterministic priority/timetable + LLM language.
    """
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI learning recommendations are reserved for student accounts.",
        )

    try:
        return generate_recommendations_for_student(db, current_user, constraints)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Recommendation error: {str(e)}")
