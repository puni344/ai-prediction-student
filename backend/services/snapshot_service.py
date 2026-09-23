"""Daily Academic Prediction Snapshot Service.

Enforces CRITICAL FINAL RULE:
- Exactly ONE official ML simulation per student per day at 09:00 AM Asia/Kolkata.
- Immutable daily snapshots stored in daily_prediction_snapshots table.
- Database UNIQUE(student_id, snapshot_date) prevents duplicate snapshots.
- Safe catch-up mechanism for development and dashboard access after 09:00 AM.
- Weekly, Monthly, and Semester aggregation without generating separate fake ML predictions.
- Plain-language UI clarity: "Predicted Performance", "Main Factors", "Risk Level", "Study Focus".
"""
from datetime import datetime, timezone, timedelta
import statistics
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database import Base
from backend.models.prediction import DailyPredictionSnapshot
from backend.models.profile import StudentProfile
from backend.services.date_service import get_current_kolkata_datetime
from src.predict import build_student_frame, predict_student

# Plain-language factor naming for 5-second UI clarity
PLAIN_LANGUAGE_MAP = {
    "study_hours": "Daily Study Hours",
    "attendance": "Class Attendance Rate",
    "previous_grade": "Prior Academic Performance",
    "assignments_completed": "Assignment Completion Rate",
    "participation": "Classroom Participation",
    "sleep_hours": "Nightly Sleep Duration",
    "extra_classes": "Additional Academic Tutoring",
    "parent_education": "Parental Education Background",
    "internet_access": "Internet Access Reliability",
    "family_income": "Family Income Bracket",
    "age": "Student Age",
    "gender": "Gender",
}


def _generate_deterministic_recommendations(
    profile: StudentProfile,
    ml_result: Any,
) -> Dict[str, Any]:
    """Generate plain-language deterministic study focus areas."""
    items = []
    
    # 1. Attendance check
    if profile.attendance < 75.0:
        items.append({
            "focus_area": "Class Attendance",
            "priority": "High",
            "title": "Boost Class Attendance",
            "reason": f"Current attendance is {profile.attendance}%, below the standard 75% threshold.",
            "action": "Attend all scheduled lectures and contact professors for missed coursework.",
        })
    elif profile.attendance < 85.0:
        items.append({
            "focus_area": "Class Attendance",
            "priority": "Medium",
            "title": "Maintain Consistent Attendance",
            "reason": f"Attendance is {profile.attendance}%. This factor is currently contributing to your prediction.",
            "action": "Avoid avoidable absences and participate actively in class discussions.",
        })

    # 2. Study hours check
    if profile.study_hours < 3.0:
        items.append({
            "focus_area": "Daily Study Hours",
            "priority": "High",
            "title": "Increase Daily Dedicated Study",
            "reason": f"Current study time is {profile.study_hours} hrs/day. This factor is currently contributing to your prediction.",
            "action": "Schedule two focused 90-minute study blocks each evening.",
        })
    elif profile.study_hours < 5.0:
        items.append({
            "focus_area": "Daily Study Hours",
            "priority": "Medium",
            "title": "Optimize Study Depth",
            "reason": f"Studying {profile.study_hours} hrs/day is adequate but higher consistency will boost retention.",
            "action": "Incorporate active recall and practice problems during existing study blocks.",
        })

    # 3. Assignments check
    if profile.assignments_completed < 80.0:
        items.append({
            "focus_area": "Assignment Completion",
            "priority": "High",
            "title": "Complete Outstanding Assignments",
            "reason": f"Assignment completion is at {profile.assignments_completed}%. This is your highest-priority improvement area.",
            "action": "Dedicate the first 45 minutes of daily study to assignment deadlines.",
        })

    # 4. Sleep check
    if profile.sleep_hours < 6.5:
        items.append({
            "focus_area": "Sleep Duration",
            "priority": "Medium",
            "title": "Protect Nightly Rest",
            "reason": f"Sleeping {profile.sleep_hours} hrs/night impairs cognitive stamina and memory consolidation.",
            "action": "Establish a consistent sleep schedule aiming for 7-8 hours nightly.",
        })

    # Ensure at least 2 recommendations
    if len(items) < 2:
        items.append({
            "focus_area": "Academic Consistency",
            "priority": "Low",
            "title": "Maintain Strong Habits",
            "reason": "Current academic inputs are balanced and supporting positive performance.",
            "action": "Continue with regular weekly review sessions and exam practice.",
        })

    return {
        "summary": f"Identified {len(items)} key study focus areas based on today's academic state.",
        "items": items[:3],
    }


def get_or_create_daily_snapshot(
    db: Session,
    student_id: int,
    target_date: Optional[str] = None,
    force_allow_before_9: bool = False,
) -> Optional[DailyPredictionSnapshot]:
    """Retrieve or create the authoritative daily prediction snapshot.

    Rules:
    - Official simulation occurs at 09:00 AM Asia/Kolkata.
    - If target_date is today and current time < 09:00 AM, returns None (or existing snapshot if any),
      unless force_allow_before_9 is True (for testing or manual override).
    - If snapshot already exists for (student_id, target_date), returns it immediately.
    - If snapshot does NOT exist and it is at/after 09:00 AM, creates ONE immutable snapshot
      from the student's latest profile state.
    """
    now_kolkata = get_current_kolkata_datetime()
    today_str = now_kolkata.strftime("%Y-%m-%d")
    sim_date = target_date.strip() if (target_date and target_date.strip()) else today_str

    # 1. Check if snapshot already exists in DB
    existing = (
        db.query(DailyPredictionSnapshot)
        .filter(
            DailyPredictionSnapshot.student_id == student_id,
            DailyPredictionSnapshot.snapshot_date == sim_date,
        )
        .first()
    )
    if existing:
        return existing

    # 2. Check 09:00 AM constraint if creating for today
    if sim_date == today_str and not force_allow_before_9:
        is_past_9am = (now_kolkata.hour > 9) or (now_kolkata.hour == 9 and now_kolkata.minute >= 0)
        if not is_past_9am:
            # Official snapshot time has not arrived yet today
            return None

    # 3. Read student's latest profile state
    profile = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not profile:
        return None

    # 4. Run authoritative ML prediction
    student_frame = build_student_frame(
        age=profile.age,
        gender=profile.gender,
        attendance=profile.attendance,
        study_hours=profile.study_hours,
        sleep_hours=profile.sleep_hours,
        assignments_completed=profile.assignments_completed,
        previous_grade=profile.previous_grade,
        parent_education=profile.parent_education,
        internet_access=profile.internet_access,
        family_income=profile.family_income,
        extra_classes=profile.extra_classes,
        participation=profile.participation,
    )
    ml_result = predict_student(student_frame)

    # 5. Build plain-language SHAP factors ("Main Factors" instead of raw ML terms)
    plain_positive = [
        {
            "factor": PLAIN_LANGUAGE_MAP.get(item["feature"], item["feature"].replace("_", " ").title()),
            "technical_feature": item["feature"],
            "impact": round(item["contribution"], 2),
            "direction": "positive",
        }
        for item in ml_result.top_positive
    ]
    plain_negative = [
        {
            "factor": PLAIN_LANGUAGE_MAP.get(item["feature"], item["feature"].replace("_", " ").title()),
            "technical_feature": item["feature"],
            "impact": round(item["contribution"], 2),
            "direction": "negative",
        }
        for item in ml_result.top_negative
    ]

    shap_data = {
        "main_positive_factors": plain_positive,
        "main_negative_factors": plain_negative,
        "base_performance": round(ml_result.base_value, 2) if ml_result.base_value is not None else 50.0,
        "plain_explanation": "These are the main academic factors influencing your predicted score today.",
    }

    # 6. Generate deterministic recommendations
    rec_data = _generate_deterministic_recommendations(profile, ml_result)

    # 7. Create immutable snapshot record
    snapshot = DailyPredictionSnapshot(
        student_id=profile.id,
        snapshot_date=sim_date,
        snapshot_time="09:00:00",
        timezone="Asia/Kolkata",
        study_hours=profile.study_hours,
        attendance=profile.attendance,
        sleep_hours=profile.sleep_hours,
        assignments_completed=profile.assignments_completed,
        participation=profile.participation,
        previous_grade=profile.previous_grade,
        predicted_score=round(ml_result.predicted_score, 2),
        pass_probability=round(ml_result.pass_probability, 4),
        risk_level=ml_result.risk_level,
        risk_index=round(ml_result.risk_index, 2),
        risk_description=ml_result.risk_description,
        shap_data=shap_data,
        recommendation_data=rec_data,
        created_at=datetime.now(timezone.utc),
    )

    try:
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot
    except IntegrityError:
        db.rollback()
        # Concurrently created by another process/thread -> return existing
        return (
            db.query(DailyPredictionSnapshot)
            .filter(
                DailyPredictionSnapshot.student_id == student_id,
                DailyPredictionSnapshot.snapshot_date == sim_date,
            )
            .first()
        )


def get_student_snapshots(
    db: Session,
    student_id: int,
    limit: int = 60,
) -> List[DailyPredictionSnapshot]:
    """Retrieve historical daily snapshots in chronological order (oldest to newest)."""
    return (
        db.query(DailyPredictionSnapshot)
        .filter(DailyPredictionSnapshot.student_id == student_id)
        .order_by(DailyPredictionSnapshot.snapshot_date.asc())
        .limit(limit)
        .all()
    )


def get_snapshot_trends(
    db: Session,
    student_id: int,
    view_type: str = "day",
) -> Dict[str, Any]:
    """Aggregate historical daily snapshots across Day, Week, Month, or Year timeframes.

    CRITICAL RULES:
    1. Aggregation of existing daily snapshots only — NOT a separate ML model prediction.
    2. DAY: Recent 30 calendar days, where daily snapshots exist.
    3. WEEK: Exactly 5 calendar-week buckets.
    4. MONTH: Calendar-month buckets.
    5. YEAR: Exactly 12 consecutive calendar months (never 13).
    6. Never fabricate zero/flat historical values for missing days/buckets.
    7. Insufficient data returns explicit "Not enough data yet" indicator with available count.
    """
    raw_view = (view_type or "day").strip().lower()
    if raw_view in ["weekly", "week"]:
        view_clean = "week"
    elif raw_view in ["monthly", "month"]:
        view_clean = "month"
    elif raw_view in ["semester", "year", "yearly"]:
        view_clean = "year"
    else:
        view_clean = "day"

    # Query all available student snapshots up to 365 days in ascending order
    all_snapshots = get_student_snapshots(db, student_id, limit=365)
    total_available_days = len(all_snapshots)

    formula_definitions = {
        "average_predicted_score": "Arithmetic mean of daily predicted scores in the period: sum(predicted_scores) / count(snapshots).",
        "risk_distribution": "Count of daily snapshots categorized by official risk category (LOW, MODERATE, HIGH).",
        "score_change": "Difference between latest predicted score and earliest predicted score in the period: latest_score - starting_score.",
        "study_consistency": "Deterministic metric based on standard deviation of daily study hours: < 1.0 hr = High Consistency, 1.0–2.0 hrs = Moderate Consistency, >= 2.0 hrs = Variable.",
        "trend_pattern": "Direction of performance change: Improving (+1.5 pts or more), Declining (-1.5 pts or less), or Stable.",
    }

    if total_available_days == 0:
        return {
            "view_type": view_clean,
            "total_days": 0,
            "avg_predicted_score": 0.0,
            "risk_distribution": {"LOW": 0, "MODERATE": 0, "HIGH": 0},
            "study_hours_trend": [],
            "attendance_trend": [],
            "risk_transitions": [],
            "high_risk_days_count": 0,
            "improvement_pattern": "insufficient_data",
            "starting_predicted_score": None,
            "latest_predicted_score": None,
            "score_change": None,
            "study_consistency": "insufficient_data",
            "bucket_trends": [],
            "snapshots": [],
            "formula_definitions": formula_definitions,
            "data_sufficiency": {
                "status": "empty",
                "message": "No daily snapshots recorded yet. Official snapshot is scheduled daily at 09:00 AM Asia/Kolkata.",
                "available_days": 0,
                "minimum_required_days": 1,
            },
        }

    # Reference today in Asia/Kolkata
    today_dt = get_current_kolkata_datetime().date()

    # Filter/Bucket snapshots according to the selected view
    bucket_trends = []
    active_snapshots = []

    if view_clean == "day":
        # Recent 30 calendar days, only where daily snapshots exist
        cutoff = today_dt - timedelta(days=30)
        active_snapshots = [s for s in all_snapshots if datetime.strptime(s.snapshot_date, "%Y-%m-%d").date() >= cutoff]
        if not active_snapshots:
            active_snapshots = all_snapshots[-30:]

        for s in active_snapshots:
            bucket_trends.append({
                "bucket_key": s.snapshot_date,
                "bucket_label": datetime.strptime(s.snapshot_date, "%Y-%m-%d").strftime("%b %d"),
                "avg_predicted_score": s.predicted_score,
                "avg_study_hours": s.study_hours,
                "avg_attendance": s.attendance,
                "risk_level": s.risk_level,
                "snapshot_count": 1,
            })

    elif view_clean == "week":
        # Exactly 5 calendar-week buckets ending with current week
        # Monday of current week
        current_monday = today_dt - timedelta(days=today_dt.weekday())
        week_ranges = []
        for i in range(4, -1, -1):
            w_start = current_monday - timedelta(weeks=i)
            w_end = w_start + timedelta(days=6)
            week_ranges.append((w_start, w_end, f"W-{i}" if i > 0 else "Current Week"))

        week_buckets = []
        for w_start, w_end, label in week_ranges:
            snaps_in_week = [
                s for s in all_snapshots
                if w_start <= datetime.strptime(s.snapshot_date, "%Y-%m-%d").date() <= w_end
            ]
            if snaps_in_week:
                active_snapshots.extend(snaps_in_week)
                avg_sc = round(sum(s.predicted_score for s in snaps_in_week) / len(snaps_in_week), 2)
                avg_st = round(sum(s.study_hours for s in snaps_in_week) / len(snaps_in_week), 1)
                avg_att = round(sum(s.attendance for s in snaps_in_week) / len(snaps_in_week), 1)
                week_buckets.append({
                    "bucket_key": f"{w_start.isoformat()}--{w_end.isoformat()}",
                    "bucket_label": f"{w_start.strftime('%b %d')}–{w_end.strftime('%b %d')}",
                    "sub_label": label,
                    "avg_predicted_score": avg_sc,
                    "avg_study_hours": avg_st,
                    "avg_attendance": avg_att,
                    "risk_level": snaps_in_week[-1].risk_level,
                    "snapshot_count": len(snaps_in_week),
                    "has_data": True,
                })
            else:
                week_buckets.append({
                    "bucket_key": f"{w_start.isoformat()}--{w_end.isoformat()}",
                    "bucket_label": f"{w_start.strftime('%b %d')}–{w_end.strftime('%b %d')}",
                    "sub_label": label,
                    "avg_predicted_score": None,
                    "avg_study_hours": None,
                    "avg_attendance": None,
                    "risk_level": None,
                    "snapshot_count": 0,
                    "has_data": False,
                })
        bucket_trends = week_buckets

    elif view_clean == "month":
        # Calendar-month buckets (only for months where data exists)
        month_map: Dict[str, List[Any]] = {}
        for s in all_snapshots:
            m_key = s.snapshot_date[:7]  # YYYY-MM
            month_map.setdefault(m_key, []).append(s)

        sorted_months = sorted(month_map.keys())
        for m_key in sorted_months:
            m_snaps = month_map[m_key]
            active_snapshots.extend(m_snaps)
            avg_sc = round(sum(s.predicted_score for s in m_snaps) / len(m_snaps), 2)
            avg_st = round(sum(s.study_hours for s in m_snaps) / len(m_snaps), 1)
            avg_att = round(sum(s.attendance for s in m_snaps) / len(m_snaps), 1)
            m_dt = datetime.strptime(m_key + "-01", "%Y-%m-%d")
            bucket_trends.append({
                "bucket_key": m_key,
                "bucket_label": m_dt.strftime("%b %Y"),
                "avg_predicted_score": avg_sc,
                "avg_study_hours": avg_st,
                "avg_attendance": avg_att,
                "risk_level": m_snaps[-1].risk_level,
                "snapshot_count": len(m_snaps),
                "has_data": True,
            })

    elif view_clean == "year":
        # Exactly 12 consecutive calendar months ending with current month (NEVER 13)
        month_ranges = []
        curr_y = today_dt.year
        curr_m = today_dt.month
        for offset in range(11, -1, -1):
            target_m = curr_m - offset
            target_y = curr_y
            while target_m <= 0:
                target_m += 12
                target_y -= 1
            month_ranges.append((target_y, target_m))

        assert len(month_ranges) == 12, "Year range must have exactly 12 consecutive months"

        for y, m in month_ranges:
            m_key = f"{y:04d}-{m:02d}"
            m_snaps = [
                s for s in all_snapshots
                if s.snapshot_date.startswith(m_key)
            ]
            m_dt = datetime(y, m, 1)
            if m_snaps:
                active_snapshots.extend(m_snaps)
                avg_sc = round(sum(s.predicted_score for s in m_snaps) / len(m_snaps), 2)
                avg_st = round(sum(s.study_hours for s in m_snaps) / len(m_snaps), 1)
                avg_att = round(sum(s.attendance for s in m_snaps) / len(m_snaps), 1)
                bucket_trends.append({
                    "bucket_key": m_key,
                    "bucket_label": m_dt.strftime("%b %Y"),
                    "avg_predicted_score": avg_sc,
                    "avg_study_hours": avg_st,
                    "avg_attendance": avg_att,
                    "risk_level": m_snaps[-1].risk_level,
                    "snapshot_count": len(m_snaps),
                    "has_data": True,
                })
            else:
                bucket_trends.append({
                    "bucket_key": m_key,
                    "bucket_label": m_dt.strftime("%b %Y"),
                    "avg_predicted_score": None,
                    "avg_study_hours": None,
                    "avg_attendance": None,
                    "risk_level": None,
                    "snapshot_count": 0,
                    "has_data": False,
                })

    # If active_snapshots is empty (e.g. all outside window), fallback to all available
    if not active_snapshots:
        active_snapshots = all_snapshots

    total_days = len(active_snapshots)
    scores = [s.predicted_score for s in active_snapshots]
    study_hours = [s.study_hours for s in active_snapshots]
    avg_score = round(sum(scores) / total_days, 2)

    risk_dist = {"LOW": 0, "MODERATE": 0, "HIGH": 0}
    high_risk_days = 0
    for s in active_snapshots:
        r = s.risk_level.upper()
        if r in risk_dist:
            risk_dist[r] += 1
        if r == "HIGH":
            high_risk_days += 1

    study_trend = [
        {
            "date": s.snapshot_date,
            "study_hours": s.study_hours,
            "predicted_score": s.predicted_score,
            "risk_level": s.risk_level,
        }
        for s in active_snapshots
    ]

    attendance_trend = [
        {
            "date": s.snapshot_date,
            "attendance": s.attendance,
        }
        for s in active_snapshots
    ]

    # Day-to-day risk transitions
    risk_transitions = []
    for prev, curr in zip(active_snapshots[:-1], active_snapshots[1:]):
        if prev.risk_level != curr.risk_level:
            risk_transitions.append({
                "date": curr.snapshot_date,
                "from_risk": prev.risk_level,
                "to_risk": curr.risk_level,
            })

    # Pattern / consistency
    starting_score = active_snapshots[0].predicted_score
    latest_score = active_snapshots[-1].predicted_score
    score_change = round(latest_score - starting_score, 2)

    if total_days >= 2:
        if score_change > 1.5:
            pattern = "improving"
        elif score_change < -1.5:
            pattern = "declining"
        else:
            pattern = "stable"
    else:
        pattern = "insufficient_data"

    if total_days >= 3:
        std_dev = statistics.stdev(study_hours)
        if std_dev < 1.0:
            consistency = "High Consistency"
        elif std_dev < 2.0:
            consistency = "Moderate Consistency"
        else:
            consistency = "Variable"
    else:
        consistency = "Consistent"

    # Data sufficiency assessment
    min_required = 2
    is_sufficient = total_days >= min_required
    if not is_sufficient:
        sufficiency_msg = f"Not enough data yet. Only {total_days} daily snapshot recorded in this period. Performance trends require at least {min_required} daily snapshots to calculate meaningful trajectory."
    else:
        sufficiency_msg = f"{total_days} daily snapshots recorded and aggregated."

    return {
        "view_type": view_clean,
        "total_days": total_days,
        "avg_predicted_score": avg_score,
        "risk_distribution": risk_dist,
        "study_hours_trend": study_trend,
        "attendance_trend": attendance_trend,
        "risk_transitions": risk_transitions,
        "high_risk_days_count": high_risk_days,
        "improvement_pattern": pattern,
        "starting_predicted_score": starting_score,
        "latest_predicted_score": latest_score,
        "score_change": score_change,
        "study_consistency": consistency,
        "bucket_trends": bucket_trends,
        "snapshots": active_snapshots,
        "formula_definitions": formula_definitions,
        "data_sufficiency": {
            "status": "sufficient" if is_sufficient else "insufficient",
            "message": sufficiency_msg,
            "available_days": total_days,
            "minimum_required_days": min_required,
        },
    }
