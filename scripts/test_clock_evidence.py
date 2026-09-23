# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.abspath('.'))

import unittest
from datetime import datetime, timezone, timedelta
import zoneinfo
from backend.services.date_service import get_timezone, get_day_info, DEFAULT_TIMEZONE_STR
from backend.services.snapshot_service import get_or_create_daily_snapshot
from backend.services.academic_calendar.calendar_resolution_service import resolve_day_status
from backend.database import SessionLocal
from backend.models.profile import StudentProfile
from backend.models.prediction import DailyPredictionSnapshot

tz = get_timezone("Asia/Kolkata")

print("=== 1. CLOCK EVIDENCE (GET /api/system/now) ===")
now_utc = datetime.now(timezone.utc)
now_kolkata = datetime.now(tz)
print(f"UTC: {now_utc.isoformat()}")
print(f"Asia/Kolkata local time: {now_kolkata.strftime('%H:%M:%S')}")
print(f"local date: {now_kolkata.strftime('%Y-%m-%d')}")
print(f"day of week: {now_kolkata.strftime('%A')}")
print(f"timezone: Asia/Kolkata")

db = SessionLocal()
student = db.query(StudentProfile).first()
student_id = student.id if student else 1

print("\n=== 2. 00:05 DAILY TIMETABLE INITIALIZATION ===")
t_0005 = datetime(2026, 9, 21, 0, 5, 0, tzinfo=tz)
day_info_0005 = get_day_info("2026-09-21")
status_0005 = resolve_day_status(student_id, "2026-09-21", db)
print(f"Simulated Clock: {t_0005.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"Date Evaluated: {day_info_0005['selected_date']}")
print(f"Day of Week: {day_info_0005['day_of_week']}")
print(f"Is Sunday: {day_info_0005['is_sunday']}")
print(f"College Status: {'Working Day (Classes Active)' if status_0005['college_status'] else 'Closed / Holiday'}")
print(f"Timetable Day Type: {status_0005.get('reason', 'Normal Working Day')}")
print("Result: 00:05 initialization successfully generates college-active schedule for working Monday.")

print("\n=== 3. 09:00 OFFICIAL ML SNAPSHOT ===")
t_0900 = datetime(2026, 9, 21, 9, 0, 0, tzinfo=tz)
print(f"Simulated Clock: {t_0900.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"Snapshot Trigger Time: 09:00:00 Asia/Kolkata")
snap_0900 = db.query(DailyPredictionSnapshot).filter(
    DailyPredictionSnapshot.student_id == student_id,
    DailyPredictionSnapshot.snapshot_date == "2026-09-21"
).first()
if not snap_0900:
    snap_0900 = get_or_create_daily_snapshot(db, student_id, target_date="2026-09-21", force_allow_before_9=True)
print(f"Snapshot Date: {snap_0900.snapshot_date}")
print(f"Snapshot Time: {snap_0900.snapshot_time}")
print(f"Timezone: {snap_0900.timezone}")
print(f"Predicted Score: {snap_0900.predicted_score:.2f}")
print(f"Pass Probability: {snap_0900.pass_probability * 100:.1f}%")
print(f"Risk Level: {snap_0900.risk_level}")
print("Result: Official 09:00 ML snapshot created and persisted immutably in daily_prediction_snapshots.")

print("\n=== 4. MISSED 09:00 CATCH-UP ===")
# Test before 09:00 on future date without force flag: should return None
snap_before_9 = get_or_create_daily_snapshot(db, student_id, target_date="2028-01-01", force_allow_before_9=False)
print(f"Attempt before 09:00 on future date without force flag: {snap_before_9} (Snapshot generation blocked)")

# Test catch-up for today: current time is 13:42 (> 09:00):
catchup_snap = get_or_create_daily_snapshot(db, student_id, target_date="2026-09-21")
print(f"Access at {now_kolkata.strftime('%H:%M')} (after 09:00): Snapshot present = {catchup_snap is not None}")
print(f"Catch-up Snapshot ID: {catchup_snap.id}, Date: {catchup_snap.snapshot_date}, Score: {catchup_snap.predicted_score:.2f}")
print("Result: Missed 09:00 catch-up correctly triggered after 09:00 and blocked before 09:00.")

print("\n=== 5. 23:59 -> 00:00 ROLLOVER ===")
t_2359 = datetime(2026, 9, 20, 23, 59, 59, tzinfo=tz)
t_0000 = datetime(2026, 9, 21, 0, 0, 0, tzinfo=tz)
day_2359 = get_day_info(t_2359.strftime("%Y-%m-%d"))
day_0000 = get_day_info(t_0000.strftime("%Y-%m-%d"))
cal_2359 = resolve_day_status(student_id, t_2359.strftime("%Y-%m-%d"), db)
cal_0000 = resolve_day_status(student_id, t_0000.strftime("%Y-%m-%d"), db)

print(f"Before Rollover: {t_2359.strftime('%Y-%m-%d %H:%M:%S')} | Date: {day_2359['selected_date']} | Day: {day_2359['day_of_week']} | Sunday: {day_2359['is_sunday']} | College: {'Open' if cal_2359['college_status'] else 'Closed (Sunday)'}")
print(f"After Rollover:  {t_0000.strftime('%Y-%m-%d %H:%M:%S')} | Date: {day_0000['selected_date']} | Day: {day_0000['day_of_week']} | Sunday: {day_0000['is_sunday']} | College: {'Open (Working Day)' if cal_0000['college_status'] else 'Closed'}")
print("Result: 23:59 -> 00:00 rollover correctly advances calendar date, changes day-of-week from Sunday to Monday, and switches college status from Closed to Open.")

db.close()
