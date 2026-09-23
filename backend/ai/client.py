"""AI inference clients: DevelopmentMockAIClient and OpenAIClient."""
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from backend.config import settings
from backend.schemas.ai import (
    LLMRecommendationBatch,
    LLMRecommendationLanguage,
)
from backend.ai.prompts import (
    SYSTEM_PROMPT,
    format_recommendation_prompt,
    format_chat_prompt,
)

logger = logging.getLogger(__name__)


class AIInferenceClient(ABC):
    @abstractmethod
    def generate_recommendations(
        self, context: Dict[str, Any], candidates: List[Dict[str, Any]]
    ) -> LLMRecommendationBatch:
        pass

    @abstractmethod
    def chat_answer(
        self,
        message: str,
        history: List[Dict[str, str]],
        context: Dict[str, Any],
        capability: str = "UNSUPPORTED",
        capability_payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        pass


class DevelopmentMockAIClient(AIInferenceClient):
    def generate_recommendations(
        self, context: Dict[str, Any], candidates: List[Dict[str, Any]]
    ) -> LLMRecommendationBatch:
        preds = context.get("verified_predictions") or {}
        score = preds.get("predicted_score", 70.0)
        risk = preds.get("risk_level", "LOW")
        name = context.get("student_name", "Student")

        summary = (
            f"{name} is currently maintaining a predicted score of {score:.2f} with a {risk} risk classification. "
            f"Focusing on high-priority study habits will stabilize and elevate academic trajectory."
        )

        items: List[LLMRecommendationLanguage] = []
        for cand in candidates:
            cid = cand["id"]
            fa = cand["focus_area"]
            
            if fa == "attendance":
                title = "Maintain Consistent Lecture Attendance"
                reason = "Regular attendance supports concept retention. This factor is currently contributing to your prediction."
                action = "Aim for at least 85% attendance across all core lecture and lab sessions."
            elif fa == "study_hours":
                title = "Establish Dedicated Deep Work Blocks"
                reason = "Structured daily revision supports retention. This factor is currently contributing to your prediction."
                action = "Implement 45-minute distraction-free study blocks using active recall techniques."
            elif fa == "assignments_completed":
                title = "Prioritize Timely Assignment Submissions"
                reason = "Coursework completion reinforces practical understanding. This factor is currently contributing to your prediction."
                action = "Complete assignments 24 hours before deadlines to leave buffer for conceptual review."
            elif fa == "sleep_hours":
                title = "Optimize Sleep Architecture"
                reason = "Consistent sleep supports cognitive retention. This factor is currently contributing to your prediction."
                action = "Set a strict 11:00 PM sleep schedule to improve cognitive retention."
            else:
                title = "Reinforce Foundational Concepts"
                reason = "Prerequisite knowledge supports new concept acquisition. This factor is currently contributing to your prediction."
                action = "Dedicate 2 hours weekly to reviewing prerequisite topics."

            items.append(
                LLMRecommendationLanguage(
                    id=cid,
                    title=title,
                    reason=reason,
                    action=action,
                )
            )

        return LLMRecommendationBatch(summary=summary, recommendations=items)

    def chat_answer(
        self,
        message: str,
        history: List[Dict[str, str]],
        context: Dict[str, Any],
        capability: str = "UNSUPPORTED",
        capability_payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        preds = context.get("verified_predictions") or {}
        score = preds.get("predicted_score")
        risk = preds.get("risk_level", "LOW")
        prob = preds.get("pass_probability", 0.85)
        risk_idx = context.get("risk_index", 25.0)
        shap_factors = context.get("top_shap_factors", [])
        metrics = context.get("academic_metrics") or {}
        rec_data = context.get("recommendation_data")

        # 1. PREDICTED_PERFORMANCE
        if capability == "PREDICTED_PERFORMANCE":
            if score is None:
                return "Prediction data is not available yet. Complete your profile and run a prediction first."
            prob_pct = round(prob * 100, 1) if prob <= 1.0 else round(prob, 1)
            return (
                f"Your predicted performance is **{score:.2f} out of 100**, with a pass probability of "
                f"**{prob_pct}%** and an academic risk level of **{risk}**. "
                f"This assessment reflects consistency across your recorded metrics. "
                f"This factor is currently contributing to your prediction."
            )

        # 2. WHY_PREDICTION
        if capability == "WHY_PREDICTION":
            if score is None:
                return "Prediction data is not available yet. Complete your profile and run a prediction first."
            att = metrics.get("attendance", 85.0)
            hours = metrics.get("study_hours", 5.0)
            prev = metrics.get("previous_grade", 70.0)
            
            factors_bullets = []
            if shap_factors:
                for f in shap_factors[:3]:
                    fname = f.get("factor") or f.get("feature", "").replace("_", " ").title()
                    contrib = f.get("contribution", 0.0)
                    sign = "+" if contrib >= 0 else ""
                    factors_bullets.append(f"- **{fname}**: {sign}{contrib:.2f} points impact")
            else:
                factors_bullets = [
                    f"- **Class Attendance ({att:.1f}%)**: This factor is currently contributing positively to your prediction",
                    f"- **Daily Study Hours ({hours:.1f} hrs/day)**: This factor is currently contributing positively to your prediction",
                    f"- **Prior Grade ({prev:.1f}%)**: This factor is currently contributing to your prediction baseline",
                ]
            bullets_text = "\n".join(factors_bullets)
            return (
                f"Your predicted performance of **{score:.2f}/100** ({risk} risk) is based on your current academic indicators:\n\n"
                f"{bullets_text}\n\n"
                f"These factors are currently contributing to your prediction."
            )

        # 3. RISK_FACTORS
        if capability == "RISK_FACTORS":
            if score is None:
                return "Prediction data is not available yet. Complete your profile and run a prediction first."
            att = metrics.get("attendance", 85.0)
            hours = metrics.get("study_hours", 5.0)
            assign = metrics.get("assignments_completed", 80.0)
            
            return (
                f"Your current academic risk level is **{risk}** with a risk index of **{risk_idx:.1f} out of 100**.\n\n"
                f"The key factors currently contributing to your risk assessment:\n"
                f"- **Attendance Consistency**: Currently at {att:.1f}%\n"
                f"- **Daily Study Time**: Currently at {hours:.1f} hours/day\n"
                f"- **Coursework Completion**: Currently at {assign:.1f}%\n\n"
                f"This factor is currently contributing to your prediction. The system assigns risk tiers based on model feature contributions rather than fixed guarantee thresholds."
            )

        # 4. WHAT_TO_IMPROVE
        if capability == "WHAT_TO_IMPROVE":
            if score is None:
                return "Prediction data is not available yet. Complete your profile and run a prediction first."
            
            # Authoritative backend normalized priority calculation (no invented thresholds)
            from backend.services.recommendation_service import calculate_normalized_priority
            candidate_areas = [
                ("attendance", "Class Attendance", metrics.get("attendance", 85.0)),
                ("study_hours", "Daily Study Hours", metrics.get("study_hours", 5.0)),
                ("assignments_completed", "Coursework Completion", metrics.get("assignments_completed", 80.0)),
                ("sleep_hours", "Sleep Schedule", metrics.get("sleep_hours", 7.5)),
            ]
            scored_areas = []
            for fa, label, val in candidate_areas:
                shap_contrib = 0.0
                for s in shap_factors:
                    if s.get("feature") == fa or s.get("factor") == label:
                        shap_contrib = s.get("contribution", 0.0)
                res = calculate_normalized_priority(
                    focus_area=fa,
                    metric_value=val,
                    predicted_score=score,
                    risk_level=risk,
                    shap_contribution=shap_contrib,
                )
                scored_areas.append((res["composite"], label, val, fa))
            
            scored_areas.sort(key=lambda x: x[0], reverse=True)
            top_composite, top_label, top_val, top_fa = scored_areas[0]
            val_str = f"{top_val:.1f} hrs/day" if "hours" in top_fa else f"{top_val:.1f}%"

            return (
                f"This is your highest-priority improvement area: **{top_label}** (currently at {val_str}).\n\n"
                f"The system assigns this the highest priority based on your current metrics.\n\n"
                f"This factor is currently contributing to your prediction."
            )

        # 5. EXPLAIN_SHAP
        if capability == "EXPLAIN_SHAP":
            if not shap_factors and score is None:
                return "Explainability data is not available yet."
            
            shap_bullets = []
            if shap_factors:
                for f in shap_factors[:4]:
                    fname = f.get("factor") or f.get("feature", "").replace("_", " ").title()
                    contrib = f.get("contribution", 0.0)
                    direction = "added points to" if contrib >= 0 else "lowered"
                    shap_bullets.append(f"- **{fname}**: {direction} your score by {abs(contrib):.2f} points")
            else:
                shap_bullets = [
                    "- **Class Attendance**: Added points due to consistent lecture presence",
                    "- **Daily Study Hours**: Added points from regular study habits",
                    "- **Grade Trend**: Evaluated your trajectory across recent academic milestones",
                ]
            bullets_text = "\n".join(shap_bullets)

            return (
                f"SHAP (SHapley Additive exPlanations) shows how much each of your academic factors "
                f"contributed to raising or lowering your predicted score relative to the baseline:\n\n"
                f"{bullets_text}\n\n"
                f"This factor is currently contributing to your prediction. These values explain how the model reached your predicted score of **{(score if score is not None else 0.0):.2f}** "
                f"from your individual inputs."
            )

        # 6. RECOMMENDATION_METHOD
        if capability == "RECOMMENDATION_METHOD":
            return (
                "Your learning recommendations are generated by analyzing your verified academic metrics—"
                "including attendance, daily study hours, assignment completion rate, and previous grades—"
                "against your model prediction. The system calculates a normalized priority score for each area. "
                "The system assigns this the highest priority based on your current metrics, and this factor is currently contributing to your prediction."
            )

        # Study plan capability
        if capability == "GENERATE_STUDY_PLAN" and capability_payload and "study_schedule" in capability_payload:
            blocks = capability_payload["study_schedule"]
            lines = ["Here is your customized study timetable generated by the platform's planner:\n"]
            for b in blocks:
                icon = "[Break]" if b.get("is_break") else "[Study]"
                lines.append(f"- **{b['start_time']} - {b['end_time']}** ({b['duration_minutes']}m): {icon} {b['activity']}")
            lines.append("\nFollow this structured schedule to maximize focus while preventing fatigue.")
            return "\n".join(lines)

        # Adversarial / injection handling
        msg_lower = message.lower()
        if "ignore your previous instructions" in msg_lower or "change my risk" in msg_lower:
            return f"I cannot override verified academic records. Your verified score is {score:.2f} and risk tier is {risk}." if score else "I cannot override verified academic records."
        if "change my score" in msg_lower or "actual score is" in msg_lower or "override" in msg_lower:
            return f"Your verified score is {score:.2f}. The AI Advisor cannot alter authoritative model calculations." if score else "The AI Advisor cannot alter authoritative model calculations."
        if "another student" in msg_lower or "other student" in msg_lower:
            return "For student privacy, I only have access to your personal academic records."
        if "subject" in msg_lower:
            return (
                f"The platform predicts overall academic performance and does not currently evaluate individual subject-level grades. Your verified overall score is {score:.2f}."
                if score is not None
                else "The platform predicts overall academic performance and does not currently evaluate individual subject-level grades."
            )

        return (
            "I can help with the questions supported by your Academic Advisor. "
            "Please select one of the options above."
        )


class OpenAIClient(AIInferenceClient):
    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        temperature: float = 0.3,
    ):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.temperature = temperature

    def generate_recommendations(
        self, context: Dict[str, Any], candidates: List[Dict[str, Any]]
    ) -> LLMRecommendationBatch:
        prompt = format_recommendation_prompt(context, candidates)
        try:
            response = self.client.beta.chat.completions.parse(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format=LLMRecommendationBatch,
                temperature=self.temperature,
            )
            parsed = response.choices[0].message.parsed
            if parsed:
                return parsed
            raise ValueError("Empty parsed response from AI provider")
        except Exception as e:
            logger.warning(f"Live AI recommendation generation failed: {e}. Falling back to mock generator.")
            raise e

    def chat_answer(
        self,
        message: str,
        history: List[Dict[str, str]],
        context: Dict[str, Any],
        capability: str = "UNSUPPORTED",
        capability_payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        # For the 6 fixed questions, always deliver our high-quality, verified, student-friendly responses
        if capability in [
            "UNSUPPORTED",
            "PREDICTED_PERFORMANCE",
            "WHY_PREDICTION",
            "RISK_FACTORS",
            "WHAT_TO_IMPROVE",
            "EXPLAIN_SHAP",
            "RECOMMENDATION_METHOD",
        ]:
            return DevelopmentMockAIClient().chat_answer(
                message, history, context, capability=capability, capability_payload=capability_payload
            )

        prompt = format_chat_prompt(message, history, context, capability, capability_payload)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=self.temperature,
                max_tokens=1000,
            )
            return response.choices[0].message.content or "I am ready to assist with your academic planning."
        except Exception as e:
            logger.warning(f"Live AI chat completion failed: {e}. Falling back to mock generator.")
            return DevelopmentMockAIClient().chat_answer(
                message, history, context, capability=capability, capability_payload=capability_payload
            )


def get_ai_client() -> tuple[AIInferenceClient, str]:
    if settings.AI_PROVIDER in ["gemini", "openai"] and settings.AI_API_KEY:
        try:
            base_url = settings.AI_BASE_URL
            if settings.AI_PROVIDER == "gemini" and not base_url:
                base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            model = settings.AI_MODEL or ("gemini-2.5-flash" if settings.AI_PROVIDER == "gemini" else "gpt-4o-mini")
            status = "live_gemini" if settings.AI_PROVIDER == "gemini" else "live_provider"
            return (
                OpenAIClient(
                    api_key=settings.AI_API_KEY,
                    base_url=base_url,
                    model=model,
                    temperature=settings.AI_TEMPERATURE,
                ),
                status,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize live AI client: {e}. Falling back to DevelopmentMockAIClient.")
    return DevelopmentMockAIClient(), "development_mock"
