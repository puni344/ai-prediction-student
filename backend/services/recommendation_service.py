"""Deterministic priority calculation and recommendation orchestration service."""
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.user import User
from backend.schemas.ai import (
    RecommendationResponse,
    RecommendationItem,
    StudyPlanConstraints,
    LLMRecommendationBatch,
)
from backend.ai.context_builder import build_student_ai_context
from backend.ai.client import get_ai_client, DevelopmentMockAIClient
from backend.services.planner import generate_study_schedule


def calculate_normalized_priority(
    focus_area: str,
    metric_value: float,
    predicted_score: float,
    risk_level: str,
    shap_contribution: float = 0.0,
) -> Dict[str, float]:
    """Calculate normalized [0, 100] components: Urgency, MODEL_IMPORTANCE, Weakness, Effort, Composite."""
    # 1. Weakness [0, 100] based on configurable policy thresholds
    if focus_area == "attendance":
        w = min(100.0, max(0.0, (85.0 - metric_value) / 85.0) * 100.0)
    elif focus_area == "study_hours":
        w = min(100.0, max(0.0, (8.0 - metric_value) / 8.0) * 100.0)
    elif focus_area == "assignments_completed":
        w = min(100.0, max(0.0, (90.0 - metric_value) / 90.0) * 100.0)
    elif focus_area == "sleep_hours":
        w = min(100.0, (abs(metric_value - 8.0) / 8.0) * 100.0)
    elif focus_area == "previous_grade":
        w = min(100.0, max(0.0, (75.0 - metric_value) / 75.0) * 100.0)
    else:
        w = min(100.0, max(0.0, -shap_contribution) * 12.5)

    # 2. MODEL_IMPORTANCE [0, 100] (from Random Forest feature importance - not claimed pedagogical)
    model_importance_map = {
        "previous_grade": 100.0,
        "grade_trend": 96.6,
        "attendance": 75.0,
        "study_hours": 55.0,
        "academic_engagement_score": 45.0,
        "assignments_completed": 40.0,
        "sleep_hours": 25.0,
        "participation": 20.0,
    }
    i = model_importance_map.get(focus_area, 30.0)

    # 3. Urgency [0, 100]
    u_base = 90.0 if risk_level == "HIGH" else 55.0 if risk_level == "MODERATE" else 20.0
    u = min(100.0, u_base + max(0.0, 50.0 - predicted_score) * 2.0)

    # 4. Effort [0, 100] (deterministic policy heuristics)
    effort_map = {
        "attendance": 25.0,
        "assignments_completed": 45.0,
        "sleep_hours": 35.0,
        "study_hours": 65.0,
        "previous_grade": 50.0,
        "participation": 40.0,
    }
    e = effort_map.get(focus_area, 50.0)

    # 5. Composite Priority Score [0, 100]
    p = 0.35 * u + 0.30 * i + 0.25 * w + 0.10 * (100.0 - e)
    p = max(0.0, min(100.0, p))

    return {
        "weakness": round(w, 2),
        "model_importance": round(i, 2),
        "urgency": round(u, 2),
        "effort": round(e, 2),
        "composite": round(p, 2),
    }


def generate_recommendations_for_student(
    db: Session, current_user: User, constraints: Optional[StudyPlanConstraints] = None
) -> RecommendationResponse:
    """Orchestrate verified context, deterministic priorities, planner schedule, and LLM advice."""
    if constraints is None:
        constraints = StudyPlanConstraints()

    context = build_student_ai_context(db, current_user)
    preds = context.get("verified_predictions") or {
        "predicted_score": 70.0,
        "pass_probability": 0.90,
        "risk_level": "LOW",
        "risk_index": 10.0,
    }
    metrics = context.get("academic_metrics") or {}

    # Define Candidate Focus Areas
    candidate_defs = [
        ("rec_attendance", "attendance", metrics.get("attendance", 85.0), ["attendance", "academic_engagement_score"]),
        ("rec_study_hours", "study_hours", metrics.get("study_hours", 5.0), ["study_hours", "study_efficiency"]),
        ("rec_assignments", "assignments_completed", metrics.get("assignments_completed", 80.0), ["assignments_completed", "homework_ratio"]),
        ("rec_sleep", "sleep_hours", metrics.get("sleep_hours", 7.5), ["sleep_hours", "sleep_quality_index"]),
        ("rec_foundation", "previous_grade", metrics.get("previous_grade", 70.0), ["previous_grade", "grade_trend"]),
    ]

    evaluated_candidates = []
    for cid, fa, val, factors in candidate_defs:
        # Check if negative SHAP exists for this factor
        shap_val = 0.0
        for s in context.get("top_shap_factors", []):
            if s.get("feature") == fa:
                shap_val = s.get("contribution", 0.0)

        scores = calculate_normalized_priority(
            focus_area=fa,
            metric_value=val,
            predicted_score=preds["predicted_score"],
            risk_level=preds["risk_level"],
            shap_contribution=shap_val,
        )

        p_tier = "high" if scores["composite"] >= 70.0 else "medium" if scores["composite"] >= 45.0 else "low"
        dur = 45 if p_tier == "high" else 30 if p_tier == "medium" else 20

        evaluated_candidates.append({
            "id": cid,
            "focus_area": fa,
            "priority": p_tier,
            "priority_score": scores["composite"],
            "duration_minutes": dur,
            "source_factors": factors,
            "scores": scores,
        })

    # Sort deterministically by composite priority score descending
    evaluated_candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    top_candidates = evaluated_candidates[:3]

    # Generate Deterministic Timetable via Planner
    study_plan = generate_study_schedule(constraints, top_candidates)

    # Call LLM for Natural Language (Summary, Title, Reason, Action)
    ai_client, ai_status = get_ai_client()
    ai_enhanced = True
    llm_batch: Optional[LLMRecommendationBatch] = None

    try:
        llm_batch = ai_client.generate_recommendations(context, top_candidates)
    except Exception as err:
        ai_enhanced = False
        ai_status = "deterministic_fallback"
        # Use development mock generator for fallback language
        llm_batch = DevelopmentMockAIClient().generate_recommendations(context, top_candidates)

    # Backend Composition: Merge Deterministic Metrics with LLM Language
    # VALIDATION: Verify returned IDs match deterministic candidate set
    valid_candidate_ids = {c["id"] for c in top_candidates}
    lang_map = {}
    if llm_batch:
        for item in llm_batch.recommendations:
            if item.id in valid_candidate_ids:
                lang_map[item.id] = item
            else:
                # Discard unknown IDs returned by LLM
                pass

    recommendation_items: List[RecommendationItem] = []
    for cand in top_candidates:
        cid = cand["id"]
        fa = cand["focus_area"]
        lang = lang_map.get(cid)

        if lang:
            title = lang.title
            reason = lang.reason
            action = lang.action
        else:
            title = f"Strengthen {fa.replace('_', ' ').title()}"
            reason = f"Identified as an impactful performance driver (priority score: {cand['priority_score']})."
            action = f"Dedicate {cand['duration_minutes']} minutes daily to targeted {fa.replace('_', ' ')} reinforcement."

        recommendation_items.append(
            RecommendationItem(
                id=cid,
                title=title,
                reason=reason,
                action=action,
                priority=cand["priority"],
                priority_score=cand["priority_score"],
                duration_minutes=cand["duration_minutes"],
                source_factors=cand["source_factors"],
            )
        )

    overall_priority = round(sum(c["priority_score"] for c in top_candidates) / len(top_candidates), 2)
    summary_text = (
        llm_batch.summary
        if (llm_batch and llm_batch.summary)
        else f"Evaluated {len(top_candidates)} key academic priority areas based on verified ML performance models."
    )

    all_source_factors = list({f for c in top_candidates for f in c["source_factors"]})

    return RecommendationResponse(
        generated_at=datetime.utcnow(),
        prediction_context=preds,
        overall_priority_score=overall_priority,
        summary=summary_text,
        recommendations=recommendation_items,
        study_plan=study_plan,
        source_factors=all_source_factors,
        ai_enhanced=ai_enhanced,
        ai_status=ai_status,
    )
