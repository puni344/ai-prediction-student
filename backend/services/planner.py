"""Deterministic study timetable planner."""
from datetime import datetime, timedelta
from typing import List, Dict, Any
from backend.schemas.ai import StudyPlanBlock, StudyPlanConstraints


def generate_study_schedule(
    constraints: StudyPlanConstraints, prioritized_candidates: List[Dict[str, Any]]
) -> List[StudyPlanBlock]:
    """Generate a non-overlapping, deterministic study timetable respecting constraints."""
    total_minutes = constraints.available_minutes
    max_session = constraints.max_session_minutes
    break_duration = constraints.break_minutes
    
    # Parse start time (default 18:00)
    try:
        cur_dt = datetime.strptime(constraints.preferred_start_time, "%H:%M")
    except Exception:
        cur_dt = datetime.strptime("18:00", "%H:%M")

    blocks: List[StudyPlanBlock] = []
    remaining_time = total_minutes
    candidate_idx = 0
    num_candidates = max(1, len(prioritized_candidates))

    while remaining_time >= 20:
        # Determine focus block duration
        session_len = min(remaining_time, max_session)
        # If remaining time after this session is smaller than a break, absorb it
        if remaining_time - session_len < break_duration:
            session_len = remaining_time

        cand = prioritized_candidates[candidate_idx % num_candidates]
        candidate_idx += 1

        end_dt = cur_dt + timedelta(minutes=session_len)
        activity_name = f"Focused Study: {cand['focus_area'].replace('_', ' ').title()}"
        
        blocks.append(
            StudyPlanBlock(
                start_time=cur_dt.strftime("%H:%M"),
                end_time=end_dt.strftime("%H:%M"),
                activity=activity_name,
                focus_area=cand["focus_area"],
                duration_minutes=session_len,
                is_break=False,
            )
        )
        
        cur_dt = end_dt
        remaining_time -= session_len

        # Add break if sufficient time remains
        if remaining_time >= (20 + break_duration):
            break_end = cur_dt + timedelta(minutes=break_duration)
            blocks.append(
                StudyPlanBlock(
                    start_time=cur_dt.strftime("%H:%M"),
                    end_time=break_end.strftime("%H:%M"),
                    activity="Rest & Cognitive Recovery",
                    focus_area="Rest",
                    duration_minutes=break_duration,
                    is_break=True,
                )
            )
            cur_dt = break_end
            remaining_time -= break_duration

    return blocks
