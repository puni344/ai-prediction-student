"""Holiday-Aware Timetable Simulation API router.

Endpoints:
- POST /api/timetable/simulate   — live constraint-based simulation (no ML snapshot)
- POST /api/timetable/save       — save finalized daily timetable (only when feasible)

This is a SIMULATION, not a prediction. It must NOT create an ML historical snapshot.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.security import require_role
from backend.models.user import User
from backend.services.academic_calendar.calendar_resolution_service import resolve_day_status
from backend.services.academic_calendar.calendar_schemas import (
    DayResolutionResponse,
    TimetableSimulationRequest,
    TimetableSimulationResponse,
    TimetableCapacity,
    TimetableTimelineBlock,
    TimetableConflict,
    TimetableSaveRequest,
    TimetableSaveResponse,
)

router = APIRouter(prefix="/timetable", tags=["timetable"])


def _to_minutes(time_str: str) -> int:
    """Convert HH:MM to total minutes from midnight."""
    parts = time_str.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _to_hhmm(minutes: int) -> str:
    """Convert total minutes to HH:MM."""
    minutes = minutes % 1440
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _simulate_timetable(
    req: TimetableSimulationRequest,
    day_status: dict,
) -> TimetableSimulationResponse:
    """Run the 24-hour constraint-based simulation engine.

    Places all blocks and detects conflicts instead of simple subtraction.
    """
    conflicts = []
    timeline = []

    # Parse times
    sleep_start_m = _to_minutes(req.sleep_start)
    sleep_dur_m = int(req.sleep_hours * 60)
    wake_m = (sleep_start_m + sleep_dur_m) % 1440

    college_active = day_status.get("college_status", True)
    col_start_m = _to_minutes(req.college_start)
    col_end_m = _to_minutes(req.college_end)
    college_dur_m = (col_end_m - col_start_m + 1440) % 1440 if college_active else 0

    meal_total_m = req.meal_count * req.meal_duration_minutes
    rest_total_m = req.rest_break_count * req.rest_break_duration_minutes
    study_target_m = int(req.study_hours * 60)

    # Total fixed commitments
    fixed_m = sleep_dur_m + college_dur_m + meal_total_m + rest_total_m
    available_m = 1440 - fixed_m
    max_feasible_study_m = max(0, available_m)
    remaining_buffer_m = max_feasible_study_m - study_target_m

    feasible = study_target_m <= max_feasible_study_m

    # Build timeline blocks
    # 1. Sleep block
    timeline.append(TimetableTimelineBlock(
        start_time=_to_hhmm(sleep_start_m),
        end_time=_to_hhmm(wake_m),
        activity="Sleep & Recovery",
        category="sleep",
        duration_minutes=sleep_dur_m,
    ))

    # 2. Morning routine / Breakfast
    breakfast_start = wake_m
    breakfast_dur = req.meal_duration_minutes
    breakfast_end = (breakfast_start + breakfast_dur) % 1440
    timeline.append(TimetableTimelineBlock(
        start_time=_to_hhmm(breakfast_start),
        end_time=_to_hhmm(breakfast_end),
        activity="Breakfast & Morning Routine",
        category="meal",
        duration_minutes=breakfast_dur,
    ))

    # 3. College block (if active)
    if college_active and college_dur_m > 0:
        timeline.append(TimetableTimelineBlock(
            start_time=_to_hhmm(col_start_m),
            end_time=_to_hhmm(col_end_m),
            activity="College (Classes & Labs)",
            category="college",
            duration_minutes=college_dur_m,
        ))

        # Lunch after college or mid-day
        lunch_start = col_end_m
        lunch_end = (lunch_start + req.meal_duration_minutes) % 1440
        timeline.append(TimetableTimelineBlock(
            start_time=_to_hhmm(lunch_start),
            end_time=_to_hhmm(lunch_end),
            activity="Post-College Lunch & Transition",
            category="meal",
            duration_minutes=req.meal_duration_minutes,
        ))
    else:
        # No college — lunch mid-day
        lunch_start = (breakfast_end + 240) % 1440
        lunch_end = (lunch_start + req.meal_duration_minutes) % 1440
        timeline.append(TimetableTimelineBlock(
            start_time=_to_hhmm(lunch_start),
            end_time=_to_hhmm(lunch_end),
            activity="Lunch & Midday Nutrition",
            category="meal",
            duration_minutes=req.meal_duration_minutes,
        ))

    # 4. Dinner
    if req.meal_count >= 3:
        dinner_start = (sleep_start_m - 150 + 1440) % 1440
        dinner_end = (dinner_start + req.meal_duration_minutes) % 1440
        timeline.append(TimetableTimelineBlock(
            start_time=_to_hhmm(dinner_start),
            end_time=_to_hhmm(dinner_end),
            activity="Dinner & Leisure",
            category="meal",
            duration_minutes=req.meal_duration_minutes,
        ))

    # 5. Study blocks (allocated in preferred period)
    if feasible and study_target_m > 0:
        # Simple allocation: place study after last meal or after college
        if college_active:
            study_start = (col_end_m + req.meal_duration_minutes + 15) % 1440
        else:
            study_start = (lunch_end + 30) % 1440

        remaining_study = study_target_m
        session_len = 45  # standard session length
        break_idx = 0

        while remaining_study > 0:
            actual_session = min(session_len, remaining_study)
            study_end = (study_start + actual_session) % 1440

            timeline.append(TimetableTimelineBlock(
                start_time=_to_hhmm(study_start),
                end_time=_to_hhmm(study_end),
                activity=f"Focused Study Session",
                category="study",
                duration_minutes=actual_session,
            ))

            remaining_study -= actual_session
            study_start = study_end

            # Add rest break between sessions
            if remaining_study > 0 and break_idx < req.rest_break_count:
                rest_end = (study_start + req.rest_break_duration_minutes) % 1440
                timeline.append(TimetableTimelineBlock(
                    start_time=_to_hhmm(study_start),
                    end_time=_to_hhmm(rest_end),
                    activity="Rest & Cognitive Recovery",
                    category="rest",
                    duration_minutes=req.rest_break_duration_minutes,
                ))
                study_start = rest_end
                break_idx += 1

    # Detect conflicts
    if not feasible:
        deficit_hours = (study_target_m - max_feasible_study_m) / 60
        conflicts.append(TimetableConflict(
            type="CAPACITY_EXCEEDED",
            message=(
                f"Your current plan is not feasible. "
                f"You requested {req.study_hours:.1f} hours of study, "
                f"but only {max_feasible_study_m / 60:.1f} hours are available "
                f"after college, sleep, meals and breaks. "
                f"Reduce study time by {deficit_hours:.1f} hours or adjust another constraint."
            ),
            blocks_involved=["study", "sleep", "college", "meal", "rest"],
        ))

    if fixed_m > 1440:
        conflicts.append(TimetableConflict(
            type="TOTAL_EXCEEDED_24H",
            message=(
                f"Total fixed commitments ({fixed_m / 60:.1f}h) exceed 24 hours. "
                f"Reduce college time, sleep, meals, or breaks."
            ),
            blocks_involved=["sleep", "college", "meal", "rest"],
        ))

    # Generate valid study options
    valid_options = []
    step = 0.5
    current = step
    while current <= max_feasible_study_m / 60:
        valid_options.append(round(current, 1))
        current += step

    # Feasibility message
    if feasible:
        fmsg = (
            f"Your plan is feasible! "
            f"Available study capacity: {max_feasible_study_m / 60:.1f}h. "
            f"Requested: {req.study_hours:.1f}h. "
            f"Remaining buffer: {remaining_buffer_m / 60:.1f}h."
        )
    else:
        fmsg = (
            f"Your current plan is not feasible. "
            f"You requested {req.study_hours:.1f} hours of study, "
            f"but only {max_feasible_study_m / 60:.1f} hours are available "
            f"after college, sleep, meals and breaks. "
            f"Reduce study time or adjust another constraint."
        )

    # Sort timeline chronologically
    timeline.sort(key=lambda b: _to_minutes(b.start_time))

    capacity = TimetableCapacity(
        available_hours=round(available_m / 60, 2),
        requested_study_hours=req.study_hours,
        remaining_buffer_hours=round(remaining_buffer_m / 60, 2),
        max_feasible_study_hours=round(max_feasible_study_m / 60, 2),
        college_hours=round(college_dur_m / 60, 2),
        sleep_hours=req.sleep_hours,
        meal_hours=round(meal_total_m / 60, 2),
        rest_hours=round(rest_total_m / 60, 2),
    )

    return TimetableSimulationResponse(
        feasible=feasible,
        date=req.date,
        day_status=DayResolutionResponse(**day_status),
        capacity=capacity,
        conflicts=conflicts,
        timeline=timeline,
        feasibility_message=fmsg,
        valid_study_options=valid_options,
    )


@router.post("/simulate", response_model=TimetableSimulationResponse)
def simulate_timetable(
    payload: TimetableSimulationRequest,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Live constraint-based timetable simulation.

    This is a SIMULATION, not a prediction.
    It must NOT create an ML historical snapshot.
    """
    profile = current_user.student_profile
    student_id = profile.id if profile else None

    # Resolve day status with full academic calendar awareness
    day_status = resolve_day_status(student_id, payload.date, db)

    # Run 24-hour simulation engine
    return _simulate_timetable(payload, day_status)


@router.post("/save", response_model=TimetableSaveResponse)
def save_timetable(
    payload: TimetableSaveRequest,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db),
):
    """Save finalized daily timetable. Only allows save when feasible.

    Does NOT create an ML snapshot.
    """
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    student_id = profile.id

    # First simulate to verify feasibility
    day_status = resolve_day_status(student_id, payload.simulation.date, db)
    result = _simulate_timetable(payload.simulation, day_status)

    if not result.feasible:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot save infeasible timetable. "
                f"{result.feasibility_message}"
            ),
        )

    # Update student profile with timetable values (without creating ML snapshot)
    profile.study_hours = float(payload.simulation.study_hours)
    profile.sleep_hours = float(payload.simulation.sleep_hours)

    # Save/update timetable preferences
    from backend.models.timetable import StudentTimetablePreference

    pref = db.query(StudentTimetablePreference).filter(
        StudentTimetablePreference.student_id == student_id,
    ).first()

    if not pref:
        pref = StudentTimetablePreference(
            student_id=student_id,
            college_start=payload.simulation.college_start,
            college_end=payload.simulation.college_end,
            daily_study_hours=payload.simulation.study_hours,
            sleep_hours=payload.simulation.sleep_hours,
            sleep_start=payload.simulation.sleep_start,
            rest_minutes=payload.simulation.rest_break_duration_minutes,
            meal_minutes=payload.simulation.meal_duration_minutes,
            preferred_study_period=payload.simulation.preferred_study_period,
        )
        db.add(pref)
    else:
        pref.college_start = payload.simulation.college_start
        pref.college_end = payload.simulation.college_end
        pref.daily_study_hours = payload.simulation.study_hours
        pref.sleep_hours = payload.simulation.sleep_hours
        pref.sleep_start = payload.simulation.sleep_start
        pref.rest_minutes = payload.simulation.rest_break_duration_minutes
        pref.meal_minutes = payload.simulation.meal_duration_minutes
        pref.preferred_study_period = payload.simulation.preferred_study_period

    db.commit()

    return TimetableSaveResponse(
        saved=True,
        date=payload.simulation.date,
        message="Timetable saved successfully. No ML snapshot created.",
    )
