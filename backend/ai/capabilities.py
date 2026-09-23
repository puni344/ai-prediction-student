"""Deterministic capability and intent detection for Academic FAQ Advisor."""
import re
from typing import Dict, Any, List, Tuple, Optional
from backend.schemas.ai import StudyPlanConstraints
from backend.services.planner import generate_study_schedule
from backend.services.recommendation_service import calculate_normalized_priority


def detect_and_execute_capability(
    message: str,
    history: List[Dict[str, str]],
    context: Dict[str, Any],
) -> Tuple[str, Optional[Dict[str, Any]], List[str]]:
    """Detect user intent among the 6 supported academic advisor intents.
    
    If unsupported, returns ('UNSUPPORTED', None, []).
    """
    msg = message.strip()
    msg_lower = msg.lower()

    # 1. PREDICTED_PERFORMANCE
    # e.g. "What is my predicted performance?", "predicted score", "my score"
    if any(p in msg_lower for p in [
        "what is my predicted performance",
        "predicted performance",
        "predicted score",
        "what is my score",
        "my predicted score",
        "my prediction",
        "what is my prediction",
    ]):
        return "PREDICTED_PERFORMANCE", None, ["verified_predictions", "academic_metrics"]

    # 2. WHY_PREDICTION
    # e.g. "Why did I get this prediction?", "why this prediction", "why this score"
    if any(p in msg_lower for p in [
        "why did i get this prediction",
        "why this prediction",
        "why did i get this score",
        "why this score",
        "why this result",
        "explain my score",
        "explain my prediction",
        "why is my attendance important",
        "attendance important",
    ]):
        return "WHY_PREDICTION", None, ["verified_predictions", "top_shap_factors", "academic_metrics"]

    # 3. RISK_FACTORS
    # e.g. "What are my main risk factors?", "risk factors", "my risk"
    if any(p in msg_lower for p in [
        "what are my main risk factors",
        "main risk factors",
        "risk factors",
        "my risk factors",
        "why is my risk",
        "risk level",
        "risk tier",
    ]):
        return "RISK_FACTORS", None, ["verified_predictions", "risk_index", "academic_metrics"]

    # 4. WHAT_TO_IMPROVE
    # e.g. "What should I improve first?", "what to improve", "what should i prioritize"
    if any(p in msg_lower for p in [
        "what should i improve first",
        "what to improve first",
        "what should i improve",
        "what to improve",
        "what should i prioritize",
        "what to prioritize",
        "priorities",
        "what can i do better",
        "how can i improve",
        "struggling to stay consistent",
        "stay consistent",
    ]):
        return "WHAT_TO_IMPROVE", None, ["academic_metrics", "verified_predictions", "top_shap_factors"]

    # 5. EXPLAIN_SHAP
    # e.g. "Explain my SHAP factors.", "explain my factors", "shap factors", "treeshap"
    if any(p in msg_lower for p in [
        "explain my shap factors",
        "explain my factors",
        "explain shap",
        "shap factors",
        "treeshap",
        "shap",
        "feature attribution",
        "feature drivers",
    ]):
        return "EXPLAIN_SHAP", None, ["top_shap_factors", "verified_predictions"]

    # 6. RECOMMENDATION_METHOD
    # e.g. "How are my learning recommendations generated?", "how are recommendations generated"
    if any(p in msg_lower for p in [
        "how are my learning recommendations generated",
        "how are recommendations generated",
        "how are my recommendations generated",
        "recommendation method",
        "recommendations generated",
        "my recommendations",
    ]):
        return "RECOMMENDATION_METHOD", None, ["priority_engine", "recommendation_logic"]

    # 7. Study plan generation / timetable follow-up (supporting planner agent tests)
    is_study_plan = any(
        k in msg_lower
        for k in ["study plan", "timetable", "study schedule", "study routine", "schedule today", "create a plan", "make a plan", "stay focused for"]
    )
    is_plan_followup = False
    if not is_study_plan and history:
        last_assistant_msgs = [h.get("content", "").lower() for h in history if h.get("role") == "assistant"]
        if last_assistant_msgs and any(k in last_assistant_msgs[-1] for k in ["schedule", "timetable", "study plan", "focus session"]):
            if any(k in msg_lower for k in ["shorter", "longer", "reduce", "extend", "less time", "more time", "make it", "can you change"]):
                is_plan_followup = True

    if is_study_plan or is_plan_followup:
        minutes = 120
        if "shorter" in msg_lower or "less time" in msg_lower or "reduce" in msg_lower:
            minutes = 60
        elif "longer" in msg_lower or "more time" in msg_lower or "extend" in msg_lower:
            minutes = 180

        m_match = re.search(r'(\d+)\s*(?:minute|min|m|hour|hr|h)', msg_lower)
        if m_match:
            val = int(m_match.group(1))
            if any(h in msg_lower for h in ["hour", "hr", "h"]):
                val = val * 60
            if 30 <= val <= 480:
                minutes = val

        start_time = "18:00"
        t_match = re.search(r'(\d{1,2}):(\d{2})', msg_lower)
        if t_match:
            start_time = f"{int(t_match.group(1)):02d}:{t_match.group(2)}"

        metrics = context.get("academic_metrics") or {}
        preds = context.get("verified_predictions") or {"predicted_score": 70.0, "risk_level": "LOW"}
        candidate_defs = [
            ("rec_attendance", "attendance", metrics.get("attendance", 85.0), ["attendance", "academic_engagement_score"]),
            ("rec_study_hours", "study_hours", metrics.get("study_hours", 5.0), ["study_hours", "study_efficiency"]),
            ("rec_assignments", "assignments_completed", metrics.get("assignments_completed", 80.0), ["assignments_completed", "homework_ratio"]),
            ("rec_sleep", "sleep_hours", metrics.get("sleep_hours", 7.5), ["sleep_hours", "sleep_quality_index"]),
            ("rec_foundation", "previous_grade", metrics.get("previous_grade", 70.0), ["previous_grade", "grade_trend"]),
        ]

        evaluated = []
        for cid, fa, val, factors in candidate_defs:
            shap_val = 0.0
            for s in context.get("top_shap_factors", []):
                if s.get("feature") == fa:
                    shap_val = s.get("contribution", 0.0)

            scores = calculate_normalized_priority(
                focus_area=fa,
                metric_value=val,
                predicted_score=preds.get("predicted_score", 70.0),
                risk_level=preds.get("risk_level", "LOW"),
                shap_contribution=shap_val,
            )
            p_tier = "high" if scores["composite"] >= 70.0 else "medium" if scores["composite"] >= 45.0 else "low"
            dur = 45 if p_tier == "high" else 30 if p_tier == "medium" else 20
            evaluated.append({
                "id": cid,
                "focus_area": fa,
                "priority": p_tier,
                "priority_score": scores["composite"],
                "duration_minutes": dur,
                "source_factors": factors,
            })
        evaluated.sort(key=lambda x: x["priority_score"], reverse=True)
        top_cands = evaluated[:3]

        constraints = StudyPlanConstraints(available_minutes=minutes, preferred_start_time=start_time)
        schedule = generate_study_schedule(constraints, top_cands)

        context_used = ["planner", "study_schedule", "study_hours", "attendance"]
        return "GENERATE_STUDY_PLAN", {
            "constraints": {"available_minutes": minutes, "preferred_start_time": start_time},
            "study_schedule": [s.model_dump() for s in schedule],
            "top_candidates": top_cands,
        }, context_used

    # 8. All other queries are UNSUPPORTED
    return "UNSUPPORTED", None, []
