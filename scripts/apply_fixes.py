# -*- coding: utf-8 -*-
import re

# 1. Update backend/ai/client.py
client_path = 'backend/ai/client.py'
with open(client_path, 'r', encoding='utf-8') as f:
    client_code = f.read()

client_code = client_code.replace(
    '"Practical homework reinforces theoretical learning and contributes directly to coursework scores."',
    '"Coursework completion reinforces practical understanding. This factor is currently contributing to your prediction."'
)
client_code = client_code.replace(
    '"Regular attendance is a primary driver of retention and direct concept comprehension."',
    '"Regular attendance supports concept retention. This factor is currently contributing to your prediction."'
)
client_code = client_code.replace(
    '"Structured daily revision deepens mastery and prevents pre-exam cognitive overload."',
    '"Structured daily revision supports retention. This factor is currently contributing to your prediction."'
)
client_code = client_code.replace(
    '"7 to 8 hours of consistent sleep is essential for memory consolidation."',
    '"Consistent sleep supports cognitive retention. This factor is currently contributing to your prediction."'
)
client_code = client_code.replace(
    '"Prerequisite knowledge directly determines your rate of new concept acquisition."',
    '"Prerequisite knowledge supports new concept acquisition. This factor is currently contributing to your prediction."'
)

old_pred = """            return (
                f"Your predicted performance is **{score:.2f} out of 100**, with a pass probability of "
                f"**{prob_pct}%** and an academic risk level of **{risk}**. "
                f"This assessment reflects consistency across your recorded metrics, with study hours and attendance "
                f"actively contributing to your current prediction."
            )"""

new_pred = """            return (
                f"Your predicted performance is **{score:.2f} out of 100**, with a pass probability of "
                f"**{prob_pct}%** and an academic risk level of **{risk}**. "
                f"This assessment reflects consistency across your recorded metrics. "
                f"This factor is currently contributing to your prediction."
            )"""
client_code = client_code.replace(old_pred, new_pred)

client_code = client_code.replace(
    'Key positive contributor to exam readiness',
    'This factor is currently contributing positively to your prediction'
)
client_code = client_code.replace(
    'Consistent study routine supporting retention',
    'This factor is currently contributing positively to your prediction'
)
client_code = client_code.replace(
    'Solid academic foundation',
    'This factor is currently contributing to your prediction baseline'
)

client_code = client_code.replace(
    'The system monitors these metrics as primary indicators for your academic risk tier.',
    'This factor is currently contributing to your prediction. The system assigns risk tiers based on model feature contributions rather than fixed guarantee thresholds.'
)

old_improve_block = client_code[client_code.find('        # 4. WHAT_TO_IMPROVE'):client_code.find('        # 5. EXPLAIN_SHAP')]
new_improve_block = '''        # 4. WHAT_TO_IMPROVE
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
                f"This is your highest-priority improvement area: **{top_label}** (currently at {val_str}).\\n\\n"
                f"The system assigns this the highest priority based on your current metrics.\\n\\n"
                f"This factor is currently contributing to your prediction."
            )

'''
client_code = client_code.replace(old_improve_block, new_improve_block)

# In RECOMMENDATION_METHOD: replace "to identify where your efforts will produce the highest academic gain."
client_code = client_code.replace(
    'to identify where your efforts will produce the highest academic gain.',
    'The system assigns this the highest priority based on your current metrics, and this factor is currently contributing to your prediction.'
)

with open(client_path, 'w', encoding='utf-8') as f:
    f.write(client_code)
print('Updated backend/ai/client.py successfully!')

# 2. Update backend/services/snapshot_service.py
snap_path = 'backend/services/snapshot_service.py'
with open(snap_path, 'r', encoding='utf-8') as f:
    snap_code = f.read()

snap_code = snap_code.replace(
    'Increasing to 90%+ directly strengthens exam readiness.',
    'This factor is currently contributing to your prediction.'
)
snap_code = snap_code.replace(
    'Reaching 4+ hours significantly raises predicted score.',
    'This factor is currently contributing to your prediction.'
)
snap_code = snap_code.replace(
    'Assignment completion is at {profile.assignments_completed}%, reducing internal assessment marks.',
    'Assignment completion is at {profile.assignments_completed}%. This is your highest-priority improvement area.'
)

with open(snap_path, 'w', encoding='utf-8') as f:
    f.write(snap_code)
print('Updated backend/services/snapshot_service.py successfully!')
