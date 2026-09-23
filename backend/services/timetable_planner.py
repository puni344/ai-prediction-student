"""Deterministic 24-Hour Constrained Student Study Timetable Planner Service.

Implements strict physical invariants:
1. Hard Constraints:
   - College (if active on that day: Monday-Saturday, non-holiday)
   - Meals: Breakfast, Lunch, Dinner (exact user timings preserved)
   - Calendar Busy Intervals (from Google Calendar or institution)
   - Fixed Sleep (ONLY if explicitly marked fixed by user)
2. Meal Inside College:
   - Explicitly ALLOWED; NOT a hard-constraint conflict!
   - Preserves user-entered fixed meal time (e.g. Lunch 13:00-13:30).
   - Interrupts college visually: [col_start -> meal_start] College, [meal_start -> meal_end] Meal, [meal_end -> col_end] College.
   - For capacity math, interval union (College ∪ Meal) ensures meal minutes inside college are NOT double-counted.
3. Flexible Sleep:
   - When sleep is flexible (not explicitly fixed), sleep is NOT a hard constraint.
   - The scheduler chooses placement and duration between min_sleep and max_sleep.
   - HardOccupied = UNION(College, Meals, Calendar events).
   - RemainingFlexible = 1440 - len(HardOccupied).
   - Priority allocation:
     1. Min sleep
     2. Min study
     3. Additional sleep up to max
     4. Additional study up to max
     5. Free / personal time
4. Feasibility:
   - Min required = hard_union + min_sleep + min_study.
   - If min_required > 1440: CAPACITY_INFEASIBILITY with exact shortfall breakdown and partial preview.
   - If hard constraints incompatibly overlap (e.g. meal-meal or fixed sleep-college): HARD_CONSTRAINT_CONFLICT.
5. Invariant:
   - sum(block.duration_minutes for block in schedule) == 1440.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from backend.schemas.timetable import (
    TimetablePreferencesSchema,
    TimetableBlockSchema,
    TimetableResponse,
    TimetableValidationResult,
    CalendarBusyEventSchema,
)
from backend.services.date_service import get_day_info


def _to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes from midnight (0 - 1439)."""
    parts = time_str.strip().split(":")
    hours = int(parts[0])
    mins = int(parts[1]) if len(parts) > 1 else 0
    return (hours * 60 + mins) % 1440


def _to_hhmm(minutes: int) -> str:
    """Convert minutes from midnight to HH:MM format."""
    normalized = (minutes % 1440 + 1440) % 1440
    hours = normalized // 60
    mins = normalized % 60
    return f"{hours:02d}:{mins:02d}"


def _interval_minutes_set(start_m: int, duration_m: int) -> Set[int]:
    """Return set of minute indices covered on a 24-hour circular clock (0..1439)."""
    return {(start_m + m) % 1440 for m in range(max(0, duration_m))}


def validate_24h_constraints(prefs: TimetablePreferencesSchema) -> TimetableValidationResult:
    """Validate that the requested schedule strictly satisfies 24-hour physical constraints.

    Distinguishes:
    - CASE A: HARD_CONSTRAINT_CONFLICT
      Contradictory fixed timings (meal-meal overlap, or fixed sleep colliding with college/meals).
      No partial schedule is generated; user must adjust fixed timings.
    - CASE B: CAPACITY_INFEASIBILITY
      Fixed constraints valid, but requested flexible requirements exceed 24h capacity.
      Returns detailed shortfall and allows rendering a maximum-schedulable study partial preview.
    - VALID: Routine satisfies all constraints and fits within 1440 minutes.
    """
    if prefs.selected_date:
        day_info = get_day_info(prefs.selected_date)
        is_sun = day_info["is_sunday"]
        selected_date_str = day_info["selected_date"]
    else:
        is_sun = False
        selected_date_str = None

    is_hol = bool(prefs.is_holiday)

    # Sunday or Holiday -> NO college block
    college_active = not (is_sun or is_hol)

    # 1. College Constraint
    col_start_m = 0
    col_end_m = 0
    college_minutes = 0
    col_set: Set[int] = set()
    if college_active:
        col_start_m = _to_minutes(prefs.college_start)
        col_end_m = _to_minutes(prefs.college_end)
        college_minutes = (col_end_m - col_start_m + 1440) % 1440
        if college_minutes == 0:
            return TimetableValidationResult(
                valid=False,
                error_type="HARD_CONSTRAINT_CONFLICT",
                errorCode="INVALID_COLLEGE_TIMINGS",
                error_code="INVALID_COLLEGE_TIMINGS",
                message="College start time and end time cannot be identical.",
                college_active=True,
                collegeMinutes=0,
                is_sunday=is_sun,
                is_holiday=is_hol,
                selected_date=selected_date_str,
            )
        col_set = _interval_minutes_set(col_start_m, college_minutes)

    # 2. Fixed Meal Constraints
    b_start_str = getattr(prefs, "breakfast_start", "08:00") or "08:00"
    b_dur = getattr(prefs, "breakfast_duration", 30) or 30
    b_start_m = _to_minutes(b_start_str)
    b_set = _interval_minutes_set(b_start_m, b_dur)

    l_start_str = getattr(prefs, "lunch_start", "12:00") or "12:00"
    l_dur = getattr(prefs, "lunch_duration", 60) or 60
    l_start_m = _to_minutes(l_start_str)
    l_set = _interval_minutes_set(l_start_m, l_dur)

    d_start_str = getattr(prefs, "dinner_start", "20:00") or "20:00"
    d_dur = getattr(prefs, "dinner_duration", 30) or 30
    d_start_m = _to_minutes(d_start_str)
    d_set = _interval_minutes_set(d_start_m, d_dur)

    # 3. Calendar Busy Intervals
    calendar_busy_set: Set[int] = set()
    for ev in (prefs.calendar_events or []):
        if ev.is_all_day:
            continue
        ev_s = _to_minutes(ev.start_time)
        ev_e = _to_minutes(ev.end_time)
        ev_dur = (ev_e - ev_s + 1440) % 1440
        if ev_dur > 0:
            calendar_busy_set.update(_interval_minutes_set(ev_s, ev_dur))

    # --- CASE A: HARD CONSTRAINT CONFLICT CHECKS ---
    # Incompatible fixed meals overlap
    if b_set.intersection(l_set):
        return TimetableValidationResult(
            valid=False,
            error_type="HARD_CONSTRAINT_CONFLICT",
            errorCode="HARD_CONSTRAINT_CONFLICT",
            error_code="HARD_CONSTRAINT_CONFLICT",
            message=f"Breakfast ({b_start_str}) and Lunch ({l_start_str}) overlap. Please adjust your fixed meal timings.",
            college_active=college_active, collegeMinutes=college_minutes,
            is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
        )
    if l_set.intersection(d_set):
        return TimetableValidationResult(
            valid=False,
            error_type="HARD_CONSTRAINT_CONFLICT",
            errorCode="HARD_CONSTRAINT_CONFLICT",
            error_code="HARD_CONSTRAINT_CONFLICT",
            message=f"Lunch ({l_start_str}) and Dinner ({d_start_str}) overlap. Please adjust your fixed meal timings.",
            college_active=college_active, collegeMinutes=college_minutes,
            is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
        )
    if b_set.intersection(d_set):
        return TimetableValidationResult(
            valid=False,
            error_type="HARD_CONSTRAINT_CONFLICT",
            errorCode="HARD_CONSTRAINT_CONFLICT",
            error_code="HARD_CONSTRAINT_CONFLICT",
            message=f"Breakfast ({b_start_str}) and Dinner ({d_start_str}) overlap. Please adjust your fixed meal timings.",
            college_active=college_active, collegeMinutes=college_minutes,
            is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
        )

    # 4. Sleep: Flexible vs Explicitly Fixed
    sleep_is_fixed = bool(getattr(prefs, "sleep_is_fixed", False))
    fixed_sleep_minutes = int(round((prefs.sleep_hours or 8.0) * 60))
    sleep_start_m = _to_minutes(prefs.sleep_start or "23:00")
    fixed_wake_m = (sleep_start_m + fixed_sleep_minutes) % 1440
    fixed_wake_time = _to_hhmm(fixed_wake_m)

    sleep_set: Set[int] = set()
    if sleep_is_fixed:
        sleep_set = _interval_minutes_set(sleep_start_m, fixed_sleep_minutes)

        # Explicitly fixed sleep colliding with College
        if college_active and sleep_set.intersection(col_set):
            return TimetableValidationResult(
                valid=False,
                error_type="HARD_CONSTRAINT_CONFLICT",
                errorCode="COLLEGE_SLEEP_OVERLAP",
                error_code="COLLEGE_SLEEP_OVERLAP",
                message=f"Your fixed sleep window ({prefs.sleep_start} to {fixed_wake_time}) overlaps with your college hours ({prefs.college_start} to {prefs.college_end}). Please adjust your sleep timing or college schedule.",
                college_active=college_active, collegeMinutes=college_minutes, sleepMinutes=fixed_sleep_minutes, wakeTime=fixed_wake_time,
                is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
            )

        # Explicitly fixed sleep colliding with Meals
        if b_set.intersection(sleep_set):
            return TimetableValidationResult(
                valid=False,
                error_type="HARD_CONSTRAINT_CONFLICT",
                errorCode="HARD_CONSTRAINT_CONFLICT",
                error_code="HARD_CONSTRAINT_CONFLICT",
                message=f"Breakfast ({b_start_str}) falls inside your fixed sleep window ({prefs.sleep_start} to {fixed_wake_time}).",
                college_active=college_active, collegeMinutes=college_minutes, sleepMinutes=fixed_sleep_minutes, wakeTime=fixed_wake_time,
                is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
            )
        if l_set.intersection(sleep_set):
            return TimetableValidationResult(
                valid=False,
                error_type="HARD_CONSTRAINT_CONFLICT",
                errorCode="HARD_CONSTRAINT_CONFLICT",
                error_code="HARD_CONSTRAINT_CONFLICT",
                message=f"Lunch ({l_start_str}) falls inside your fixed sleep window ({prefs.sleep_start} to {fixed_wake_time}).",
                college_active=college_active, collegeMinutes=college_minutes, sleepMinutes=fixed_sleep_minutes, wakeTime=fixed_wake_time,
                is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
            )
        if d_set.intersection(sleep_set):
            return TimetableValidationResult(
                valid=False,
                error_type="HARD_CONSTRAINT_CONFLICT",
                errorCode="HARD_CONSTRAINT_CONFLICT",
                error_code="HARD_CONSTRAINT_CONFLICT",
                message=f"Dinner ({d_start_str}) falls inside your fixed sleep window ({prefs.sleep_start} to {fixed_wake_time}).",
                college_active=college_active, collegeMinutes=college_minutes, sleepMinutes=fixed_sleep_minutes, wakeTime=fixed_wake_time,
                is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
            )

        # Explicitly fixed sleep colliding with Calendar busy
        if calendar_busy_set.intersection(sleep_set):
            return TimetableValidationResult(
                valid=False,
                error_type="HARD_CONSTRAINT_CONFLICT",
                errorCode="CALENDAR_SLEEP_OVERLAP",
                error_code="CALENDAR_SLEEP_OVERLAP",
                message=f"A calendar event falls inside your fixed sleep window ({prefs.sleep_start} to {fixed_wake_time}).",
                college_active=college_active, collegeMinutes=college_minutes, sleepMinutes=fixed_sleep_minutes, wakeTime=fixed_wake_time,
                is_sunday=is_sun, is_holiday=is_hol, selected_date=selected_date_str,
            )

    # --- STEP 2: HARD OCCUPIED UNION ---
    # Merge all fixed intervals into set union (meal inside college NEVER double-counts!)
    hard_union: Set[int] = set()
    if college_active:
        hard_union.update(col_set)
    hard_union.update(b_set)
    hard_union.update(l_set)
    hard_union.update(d_set)
    hard_union.update(calendar_busy_set)
    if sleep_is_fixed:
        hard_union.update(sleep_set)

    hard_occupied_minutes = len(hard_union)
    break_reserve_minutes = int(getattr(prefs, "break_reserve_minutes", 120) or 120)
    remaining_flexible_minutes = max(0, 1440 - hard_occupied_minutes - break_reserve_minutes)

    # --- STEP 3: DYNAMIC ALLOWABLE RANGES & FLEXIBLE CAPACITY ---
    CFG_MIN_SLEEP_H = 6.0
    CFG_MAX_SLEEP_H = 10.0
    CFG_MIN_STUDY_H = 1.0
    CFG_MAX_STUDY_H = 16.0

    if sleep_is_fixed:
        min_allowable_sleep_h = float(prefs.sleep_hours or 8.0)
        max_allowable_sleep_h = float(prefs.sleep_hours or 8.0)
        available_study_minutes = remaining_flexible_minutes
        min_allowable_study_h = round(min(CFG_MIN_STUDY_H, available_study_minutes / 60.0), 1)
        max_allowable_study_h = round(min(CFG_MAX_STUDY_H, available_study_minutes / 60.0), 1)
    else:
        min_allowable_sleep_h = round(max(4.0, min(CFG_MIN_SLEEP_H, (remaining_flexible_minutes - CFG_MIN_STUDY_H * 60) / 60.0)), 1)
        max_allowable_sleep_h = round(max(min_allowable_sleep_h, min(CFG_MAX_SLEEP_H, (remaining_flexible_minutes - CFG_MIN_STUDY_H * 60) / 60.0)), 1)
        available_study_minutes = max(0, remaining_flexible_minutes - int(round(min_allowable_sleep_h * 60)))
        min_allowable_study_h = round(min(CFG_MIN_STUDY_H, available_study_minutes / 60.0), 1)
        max_allowable_study_h = round(min(CFG_MAX_STUDY_H, available_study_minutes / 60.0), 1)

    requested_study_minutes = int(round((prefs.daily_study_hours if prefs.daily_study_hours is not None else 2.0) * 60))
    requested_sleep_minutes = int(round((prefs.sleep_hours if prefs.sleep_hours is not None else 8.0) * 60))
    total_requested = hard_occupied_minutes + break_reserve_minutes + requested_study_minutes + (requested_sleep_minutes if not sleep_is_fixed else 0)

    # Infeasibility: Requested study exceeds available study capacity OR total requested exceeds 1440
    if total_requested > 1440 or requested_study_minutes > available_study_minutes:
        shortfall = max(total_requested - 1440, requested_study_minutes - available_study_minutes)
        return TimetableValidationResult(
            valid=False,
            error_type="CAPACITY_INFEASIBILITY",
            errorCode="DAILY_CAPACITY_EXCEEDED",
            error_code="DAILY_CAPACITY_EXCEEDED",
            message=f"Your routine requires {total_requested/60.0:.1f}h total, exceeding 24h capacity by {shortfall/60.0:.1f}h. Showing maximum schedulable study time ({available_study_minutes/60.0:.1f}h).",
            required_study_minutes=requested_study_minutes,
            shortfall_minutes=shortfall,
            is_partial_preview=True,
            hard_occupied_minutes=hard_occupied_minutes,
            break_reserve_minutes=break_reserve_minutes,
            remaining_flexible_minutes=remaining_flexible_minutes,
            min_allowable_sleep_hours=min_allowable_sleep_h,
            max_allowable_sleep_hours=max_allowable_sleep_h,
            min_allowable_study_hours=min_allowable_study_h,
            max_allowable_study_hours=max_allowable_study_h,
            available_study_minutes=available_study_minutes,
            availableStudyMinutes=available_study_minutes,
            requested_study_minutes=requested_study_minutes,
            requestedStudyMinutes=requested_study_minutes,
            total_requested_minutes=total_requested,
            totalMinutes=total_requested,
            college_active=college_active,
            college_minutes=college_minutes,
            collegeMinutes=college_minutes,
            sleep_minutes=fixed_sleep_minutes if sleep_is_fixed else requested_sleep_minutes,
            sleepMinutes=fixed_sleep_minutes if sleep_is_fixed else requested_sleep_minutes,
            meal_minutes=b_dur + l_dur + d_dur,
            mealMinutes=b_dur + l_dur + d_dur,
            wake_time=fixed_wake_time,
            wakeTime=fixed_wake_time,
            is_sunday=is_sun,
            is_holiday=is_hol,
            selected_date=selected_date_str,
        )

    # Valid Schedule
    remaining_buffer = max(0, available_study_minutes - requested_study_minutes)
    return TimetableValidationResult(
        valid=True,
        error_type=None,
        errorCode=None,
        error_code=None,
        message="Your schedule fits within 24 hours.",
        college_active=college_active,
        collegeMinutes=college_minutes,
        college_minutes=college_minutes,
        sleepMinutes=fixed_sleep_minutes if sleep_is_fixed else requested_sleep_minutes,
        sleep_minutes=fixed_sleep_minutes if sleep_is_fixed else requested_sleep_minutes,
        mealMinutes=b_dur + l_dur + d_dur,
        meal_minutes=b_dur + l_dur + d_dur,
        restMinutes=prefs.rest_minutes,
        rest_minutes=prefs.rest_minutes,
        calendarBusyMinutes=len(calendar_busy_set),
        calendar_busy_minutes=len(calendar_busy_set),
        hard_occupied_minutes=hard_occupied_minutes,
        break_reserve_minutes=break_reserve_minutes,
        remaining_flexible_minutes=remaining_flexible_minutes,
        min_allowable_sleep_hours=min_allowable_sleep_h,
        max_allowable_sleep_hours=max_allowable_sleep_h,
        min_allowable_study_hours=min_allowable_study_h,
        max_allowable_study_hours=max_allowable_study_h,
        availableMinutes=available_study_minutes,
        available_minutes=available_study_minutes,
        availableStudyMinutes=available_study_minutes,
        available_study_minutes=available_study_minutes,
        requestedStudyMinutes=requested_study_minutes,
        requested_study_minutes=requested_study_minutes,
        required_study_minutes=requested_study_minutes,
        shortfall_minutes=0,
        totalMinutes=total_requested,
        total_requested_minutes=total_requested,
        remainingBufferMinutes=remaining_buffer,
        remaining_buffer_minutes=remaining_buffer,
        wakeTime=fixed_wake_time,
        wake_time=fixed_wake_time,
        is_sunday=is_sun,
        is_holiday=is_hol,
        selected_date=selected_date_str,
        is_partial_preview=False,
    )


def _find_flexible_sleep_window(
    hard_occupied_set: Set[int],
    nominal_start_m: int,
    duration_m: int,
) -> int:
    """Find the best non-overlapping start minute for flexible sleep near nominal bedtime."""
    # Search around nominal start minute in 15-minute increments
    offsets = [0]
    for step in range(15, 360, 15):
        offsets.extend([-step, step])

    for off in offsets:
        cand_s = (nominal_start_m + off + 1440) % 1440
        cand_set = _interval_minutes_set(cand_s, duration_m)
        if not cand_set.intersection(hard_occupied_set):
            return cand_s

    # Fallback scan across all 1440 minutes
    for m in range(1440):
        if not _interval_minutes_set(m, duration_m).intersection(hard_occupied_set):
            return m

    return nominal_start_m


def generate_full_day_timetable(
    prefs: TimetablePreferencesSchema,
    priority_topics: Optional[List[Dict[str, Any]]] = None,
) -> TimetableResponse:
    """Generate a personalized, non-overlapping 24-hour study timetable."""
    validation = validate_24h_constraints(prefs)

    # If hard constraint conflict, return empty schedule and explain conflict
    if validation.error_type == "HARD_CONSTRAINT_CONFLICT":
        return TimetableResponse(
            preferences=prefs,
            validation=validation,
            summary={"status": "hard_conflict", "scheduled_study_minutes": 0},
            schedule=[],
            is_partial_preview=False,
            infeasibility_reason=validation.message,
        )

    college_active = validation.college_active
    col_start_m = _to_minutes(prefs.college_start) if college_active else 0
    col_end_m = _to_minutes(prefs.college_end) if college_active else 0
    college_minutes = (col_end_m - col_start_m + 1440) % 1440 if college_active else 0

    col_set = _interval_minutes_set(col_start_m, college_minutes) if college_active else set()

    # 1. Fixed Meals
    b_start_str = getattr(prefs, "breakfast_start", "08:00") or "08:00"
    b_dur = getattr(prefs, "breakfast_duration", 30) or 30
    b_start_m = _to_minutes(b_start_str)
    b_end_m = (b_start_m + b_dur) % 1440
    b_set = _interval_minutes_set(b_start_m, b_dur)

    l_start_str = getattr(prefs, "lunch_start", "12:00") or "12:00"
    l_dur = getattr(prefs, "lunch_duration", 60) or 60
    l_start_m = _to_minutes(l_start_str)
    l_end_m = (l_start_m + l_dur) % 1440
    l_set = _interval_minutes_set(l_start_m, l_dur)

    d_start_str = getattr(prefs, "dinner_start", "20:00") or "20:00"
    d_dur = getattr(prefs, "dinner_duration", 30) or 30
    d_start_m = _to_minutes(d_start_str)
    d_end_m = (d_start_m + d_dur) % 1440
    d_set = _interval_minutes_set(d_start_m, d_dur)

    # 2. Calendar busy
    calendar_blocks = []
    calendar_busy_set: Set[int] = set()
    for ev in (prefs.calendar_events or []):
        if ev.is_all_day:
            continue
        ev_s = _to_minutes(ev.start_time)
        ev_e = _to_minutes(ev.end_time)
        ev_dur = (ev_e - ev_s + 1440) % 1440
        if ev_dur > 0:
            calendar_busy_set.update(_interval_minutes_set(ev_s, ev_dur))
            calendar_blocks.append({
                "start": ev_s,
                "end": ev_e,
                "activity": f"Calendar: {ev.title}",
                "category": "calendar",
                "duration": ev_dur,
                "focus_area": "Calendar Event",
            })

    # Hard Occupied Union
    hard_union: Set[int] = set()
    if college_active:
        hard_union.update(col_set)
    hard_union.update(b_set)
    hard_union.update(l_set)
    hard_union.update(d_set)
    hard_union.update(calendar_busy_set)

    sleep_is_fixed = bool(getattr(prefs, "sleep_is_fixed", False))
    fixed_sleep_minutes = int(round((prefs.sleep_hours or 8.0) * 60))
    fixed_sleep_start_m = _to_minutes(prefs.sleep_start or "23:00")

    if sleep_is_fixed:
        sleep_set = _interval_minutes_set(fixed_sleep_start_m, fixed_sleep_minutes)
        hard_union.update(sleep_set)
        min_sleep_minutes = 0
        max_sleep_minutes = 0
    else:
        min_sleep_h = prefs.min_sleep_hours if prefs.min_sleep_hours is not None else (prefs.sleep_hours or 8.0)
        max_sleep_h = prefs.max_sleep_hours if prefs.max_sleep_hours is not None else max(min_sleep_h, (prefs.sleep_hours or 8.0))
        min_sleep_minutes = int(round(min_sleep_h * 60))
        max_sleep_minutes = int(round(max_sleep_h * 60))

    min_study_h = prefs.min_study_hours if prefs.min_study_hours is not None else (prefs.daily_study_hours or 2.0)
    max_study_h = prefs.max_study_hours if prefs.max_study_hours is not None else max(min_study_h, (prefs.daily_study_hours or 2.0))
    min_study_minutes = int(round(min_study_h * 60))
    max_study_minutes = int(round(max_study_h * 60))

    # Flexible Allocation Cascade
    # 1. Minimum sleep
    # 2. Minimum study
    # 3. Additional sleep up to max
    # 4. Additional study up to max
    # 5. Free / personal time
    remaining_flex = max(0, 1440 - len(hard_union))
    rem = remaining_flex

    alloc_sleep = min(rem, min_sleep_minutes)
    rem -= alloc_sleep

    alloc_study = min(rem, min_study_minutes)
    rem -= alloc_study

    extra_sleep = min(rem, max(0, max_sleep_minutes - alloc_sleep))
    alloc_sleep += extra_sleep
    rem -= extra_sleep

    extra_study = min(rem, max(0, max_study_minutes - alloc_study))
    alloc_study += extra_study
    rem -= extra_study

    alloc_free = rem

    # In partial preview, alloc_study is capped at available capacity
    study_target_min = alloc_study

    all_blocks = []

    # --- ADD HARD FIXED MEALS ---
    all_blocks.append({
        "start": b_start_m,
        "end": b_end_m,
        "activity": "Breakfast & Nutrition",
        "category": "meal",
        "duration": b_dur,
        "focus_area": None,
    })
    all_blocks.append({
        "start": l_start_m,
        "end": l_end_m,
        "activity": "Lunch & Midday Nutrition",
        "category": "meal",
        "duration": l_dur,
        "focus_area": None,
    })
    all_blocks.append({
        "start": d_start_m,
        "end": d_end_m,
        "activity": "Dinner & Leisure",
        "category": "meal",
        "duration": d_dur,
        "focus_area": None,
    })

    # --- ADD CALENDAR BLOCKS ---
    all_blocks.extend(calendar_blocks)

    # --- ADD COLLEGE BLOCKS (INTERRUPTED BY MEALS INSIDE COLLEGE) ---
    if college_active and college_minutes > 0:
        # Subtract all meal intervals from college interval
        col_meal_union = b_set.union(l_set).union(d_set)
        col_remaining_minutes = col_set - col_meal_union

        # Group contiguous intervals in chronological order starting from col_start_m
        col_intervals: List[Tuple[int, int, int]] = []
        in_block = False
        cur_start = None
        for offset in range(college_minutes):
            m = (col_start_m + offset) % 1440
            if m in col_remaining_minutes:
                if not in_block:
                    in_block = True
                    cur_start = m
            else:
                if in_block:
                    in_block = False
                    cur_dur = (m - cur_start + 1440) % 1440
                    col_intervals.append((cur_start, m, cur_dur))
        if in_block:
            end_m = (col_start_m + college_minutes) % 1440
            cur_dur = (end_m - cur_start + 1440) % 1440
            col_intervals.append((cur_start, end_m, cur_dur))

        # Create interrupted college blocks
        total_sub = len(col_intervals)
        for idx, (sub_s, sub_e, sub_d) in enumerate(col_intervals):
            if total_sub == 1:
                label = "College Academic Schedule (Classes & Labs)"
            elif idx == 0:
                label = "College Academic Schedule (Morning Sessions)"
            elif idx == total_sub - 1:
                label = "College Academic Schedule (Afternoon Sessions)"
            else:
                label = "College Academic Schedule (Midday Sessions)"
            all_blocks.append({
                "start": sub_s,
                "end": sub_e,
                "activity": label,
                "category": "college",
                "duration": sub_d,
                "focus_area": "College",
            })

    # --- ADD SLEEP BLOCK ---
    if sleep_is_fixed:
        sleep_dur = fixed_sleep_minutes
        actual_sleep_start = fixed_sleep_start_m
        actual_wake_m = (actual_sleep_start + sleep_dur) % 1440
        sleep_title = "Restorative Sleep (Fixed Constraint)"
    else:
        sleep_dur = alloc_sleep
        actual_sleep_start = _find_flexible_sleep_window(hard_union, fixed_sleep_start_m, sleep_dur)
        actual_wake_m = (actual_sleep_start + sleep_dur) % 1440
        sleep_title = f"Restorative Sleep ({sleep_dur // 60}h {sleep_dur % 60}m Flexible)"

    if sleep_dur > 0:
        all_blocks.append({
            "start": actual_sleep_start,
            "end": actual_wake_m,
            "activity": sleep_title,
            "category": "sleep",
            "duration": sleep_dur,
            "focus_area": "Sleep",
        })

    # --- COMPUTE OCCUPIED MASK & FIND FREE CONTIGUOUS WINDOWS ---
    occupied_mask = [False] * 1440
    for b in all_blocks:
        st = b["start"]
        dur = b["duration"]
        for m in range(dur):
            occupied_mask[(st + m) % 1440] = True

    free_windows = []
    in_win = False
    win_start = 0
    for m in range(1440):
        if not occupied_mask[m]:
            if not in_win:
                in_win = True
                win_start = m
        else:
            if in_win:
                in_win = False
                free_windows.append((win_start, m, m - win_start))
    if in_win:
        free_windows.append((win_start, 1440, 1440 - win_start))

    # Focus topics
    focus_titles = []
    if priority_topics:
        for t in priority_topics:
            fa = t.get("focus_area") or t.get("feature") or ""
            if fa and fa not in focus_titles:
                focus_titles.append(fa.replace("_", " ").title())
    if not focus_titles:
        focus_titles = [
            "Mathematics & Core Theory",
            "Problem Solving & Assignments",
            "Lab Preparation & Practical Revision",
            "Lecture Note Synthesis & Review",
        ]

    # Session length preference
    if prefs.session_length_preference == "pomodoro":
        nominal_session = 25
    elif prefs.session_length_preference == "deep_work":
        nominal_session = 55
    else:
        nominal_session = 45

    # Order intervals by user preference (morning, afternoon, evening, night, flexible)
    pref_period = (prefs.preferred_study_period or "evening").lower()
    def interval_pref_score(interval):
        start_min = interval[0]
        if pref_period == "morning":
            return 0 if 360 <= start_min < 720 else (1 if start_min >= 1020 else 2)
        elif pref_period == "afternoon":
            return 0 if 720 <= start_min < 1020 else (1 if 1020 <= start_min else 2)
        elif pref_period == "night":
            return 0 if start_min >= 1260 or start_min < 360 else (1 if start_min >= 1020 else 2)
        else:
            return 0 if 1020 <= start_min < 1260 else (1 if 720 <= start_min < 1020 else 2)

    free_windows.sort(key=interval_pref_score)

    remaining_study = study_target_min
    rest_break = prefs.rest_minutes or 15
    focus_idx = 0
    study_and_free_blocks = []

    for w_s, w_e, w_dur in free_windows:
        cur_p = w_s
        w_rem = w_dur
        while remaining_study > 0 and w_rem >= 20:
            sess_len = min(remaining_study, min(nominal_session, w_rem))
            if sess_len < 20:
                break
            focus_topic = focus_titles[focus_idx % len(focus_titles)]
            focus_idx += 1
            study_and_free_blocks.append({
                "start": cur_p,
                "end": (cur_p + sess_len) % 1440,
                "activity": f"Focused Study - {focus_topic}",
                "category": "study",
                "duration": sess_len,
                "focus_area": focus_topic,
            })
            cur_p += sess_len
            w_rem -= sess_len
            remaining_study -= sess_len

            if remaining_study > 0 and w_rem >= rest_break + 20:
                study_and_free_blocks.append({
                    "start": cur_p,
                    "end": (cur_p + rest_break) % 1440,
                    "activity": "Rest & Cognitive Break",
                    "category": "rest",
                    "duration": rest_break,
                    "focus_area": "Rest",
                })
                cur_p += rest_break
                w_rem -= rest_break

        if w_rem > 0:
            study_and_free_blocks.append({
                "start": cur_p,
                "end": w_e % 1440,
                "activity": "Free / Personal Time",
                "category": "routine",
                "duration": w_rem,
                "focus_area": "Personal Time",
            })

    all_blocks.extend(study_and_free_blocks)

    # Sort blocks chronologically from wake_m
    ref_time = actual_wake_m if sleep_dur > 0 else 0
    all_blocks.sort(key=lambda b: (b["start"] - ref_time + 1440) % 1440)

    schedule_blocks = [
        TimetableBlockSchema(
            start_time=_to_hhmm(b["start"]),
            end_time=_to_hhmm(b["end"]),
            activity=b["activity"],
            category=b["category"],
            duration_minutes=b["duration"],
            focus_area=b["focus_area"],
        )
        for b in all_blocks
    ]

    summary = {
        "date": validation.selected_date,
        "is_sunday": validation.is_sunday,
        "is_holiday": validation.is_holiday,
        "college_status": "Active (Classes & Labs)" if college_active else "No College Scheduled",
        "college_hours": f"{_to_hhmm(col_start_m)} - {_to_hhmm(col_end_m)} ({college_minutes // 60}h {college_minutes % 60}m)" if college_active else "None",
        "sleep_schedule": f"{_to_hhmm(actual_sleep_start)} - {_to_hhmm(actual_wake_m)} ({sleep_dur / 60:.1f} hours)",
        "daily_study_target": f"{prefs.daily_study_hours:g} hours ({int(round(prefs.daily_study_hours * 60))} mins)",
        "scheduled_study_minutes": study_target_min - remaining_study,
        "available_study_minutes": validation.availableStudyMinutes,
        "calendar_busy_minutes": validation.calendarBusyMinutes,
        "meal_duration": f"{b_dur + l_dur + d_dur} mins",
        "rest_duration": f"{rest_break} mins",
        "preferred_period": (prefs.preferred_study_period or "evening").title(),
        "fits_within_24h": validation.valid,
        "is_partial_preview": validation.is_partial_preview,
    }

    return TimetableResponse(
        preferences=prefs,
        validation=validation,
        summary=summary,
        schedule=schedule_blocks,
        is_partial_preview=validation.is_partial_preview,
        infeasibility_reason=validation.message if not validation.valid else None,
    )
