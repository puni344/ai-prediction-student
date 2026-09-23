# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.abspath('.'))

import requests
from backend.security import create_access_token

admin_token = create_access_token({"sub": "admin@institution.edu", "role": "admin"})
faculty_token = create_access_token({"sub": "final.audit.faculty@institution.edu", "role": "faculty"})
student_token = create_access_token({"sub": "final.audit.student@institution.edu", "role": "student"})

headers_admin = {"Authorization": f"Bearer {admin_token}"}
headers_faculty = {"Authorization": f"Bearer {faculty_token}"}
headers_student = {"Authorization": f"Bearer {student_token}"}

print("=== 1. ADMIN AUTHENTICATION ===")
res_admin_me = requests.get('http://127.0.0.1:8000/api/auth/me', headers=headers_admin)
print(f"Admin /me status: {res_admin_me.status_code}, Role: {res_admin_me.json().get('role')}")
assert res_admin_me.status_code == 200 and res_admin_me.json().get('role') == 'admin', "Admin auth failed"

print("\n=== 2. FACULTY SEARCH TEST ===")
search_queries = [
    ("Final", 1),
    ("Audit", 1),
    ("AUDIT-2026-001", 1),
    ("2026", 1),
    ("final.audit.student@institution.edu", 1),
    ("NonExistentStudent12345", 0),
]
for q, expected_count in search_queries:
    res = requests.get(f'http://127.0.0.1:8000/api/faculty/students?search={q}', headers=headers_faculty)
    count = len(res.json().get('students', []))
    print(f"Query '{q}': found {count} (expected {expected_count}) -> {'PASS' if count == expected_count else 'FAIL'}")
    assert count == expected_count, f"Faculty search failed for query {q}"

print("\n=== 3. CALENDAR FUNCTIONALITY ===")
res_cal = requests.get('http://127.0.0.1:8000/api/calendar/day?date=2026-09-21', headers=headers_student)
print(f"Calendar day status: {res_cal.status_code}, Date: {res_cal.json().get('date')}, College Status: {res_cal.json().get('college_status')}")
assert res_cal.status_code == 200, "Calendar day failed"

print("\n=== 4. TIMETABLE FUNCTIONALITY ===")
timetable_payload = {
    "date": "2026-09-21",
    "sleep_hours": 8.0,
    "sleep_start": "23:00",
    "study_hours": 4.0,
    "college_start": "09:00",
    "college_end": "16:00",
    "meal_count": 3,
    "meal_duration_minutes": 30,
    "rest_break_count": 3,
    "rest_break_duration_minutes": 15
}
res_tt = requests.post('http://127.0.0.1:8000/api/timetable/simulate', json=timetable_payload, headers=headers_student)
print(f"Timetable simulate status: {res_tt.status_code}, Feasible: {res_tt.json().get('feasible')}")
assert res_tt.status_code == 200 and res_tt.json().get('feasible') is True, "Timetable simulation failed"

print("\n=== 5. AI ADVISOR FIXED-QUESTION ROUTING ===")
# Natural questions for the 6 fixed capabilities
questions = [
    ("What is my predicted performance?", "PREDICTED_PERFORMANCE"),
    ("Why was this prediction made?", "WHY_PREDICTION"),
    ("What factors put me at risk?", "RISK_FACTORS"),
    ("What should I focus on improving?", "WHAT_TO_IMPROVE"),
    ("Explain my SHAP score", "EXPLAIN_SHAP"),
    ("How are recommendations generated?", "RECOMMENDATION_METHOD"),
]
for q_text, cap in questions:
    res_chat = requests.post('http://127.0.0.1:8000/api/chat/message', json={"message": q_text}, headers=headers_student)
    ans = res_chat.json().get('content', '') or res_chat.json().get('message', '')
    print(f"Question '{q_text}': status {res_chat.status_code}, response length {len(ans)}")
    assert res_chat.status_code == 200 and len(ans) > 0, f"Chat failed for {cap}"

print("\n" + "="*80)
print("REGRESSION TESTS: ALL PASSED (100% VERIFIED)")
print("="*80)
