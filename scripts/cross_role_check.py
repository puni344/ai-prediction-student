# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.abspath('.'))

import requests
import sqlite3
from backend.security import create_access_token

# 1. Create tokens with email as "sub"
student_token = create_access_token({"sub": "final.audit.student@institution.edu", "role": "student"})
faculty_token = create_access_token({"sub": "final.audit.faculty@institution.edu", "role": "faculty"})
admin_token = create_access_token({"sub": "admin@institution.edu", "role": "admin"})

# 2. Fetch from database
conn = sqlite3.connect('student_performance.db')
cursor = conn.cursor()
cursor.execute('''
    SELECT snapshot_date, predicted_score, pass_probability, risk_level 
    FROM daily_prediction_snapshots 
    WHERE student_id = 1 
    ORDER BY snapshot_date ASC
''')
db_rows = {r[0]: {"score": r[1], "pass_prob": r[2], "risk": r[3]} for r in cursor.fetchall()}

# 3. Call APIs
headers_student = {"Authorization": f"Bearer {student_token}"}
headers_faculty = {"Authorization": f"Bearer {faculty_token}"}
headers_admin = {"Authorization": f"Bearer {admin_token}"}

res_s = requests.get('http://127.0.0.1:8000/api/predictions/snapshots?limit=365', headers=headers_student)
res_f = requests.get('http://127.0.0.1:8000/api/faculty/students/1/snapshots?limit=365', headers=headers_faculty)
res_a = requests.get('http://127.0.0.1:8000/api/admin/students/1/snapshots?limit=365', headers=headers_admin)

print(f"Student API status: {res_s.status_code}, count: {len(res_s.json())}")
print(f"Faculty API status: {res_f.status_code}, count: {len(res_f.json())}")
print(f"Admin API status: {res_a.status_code}, count: {len(res_a.json())}")

student_map = {item["snapshot_date"]: item for item in res_s.json()}
faculty_map = {item["snapshot_date"]: item for item in res_f.json()}
admin_map = {item["snapshot_date"]: item for item in res_a.json()}

# 4. Select 10 representative dates across the entire year
test_dates = [
    "2026-09-20",  # First date
    "2026-10-15",
    "2026-11-20",
    "2026-12-25",
    "2027-01-15",
    "2027-03-01",
    "2027-04-15",
    "2027-06-01",
    "2027-07-20",
    "2027-09-19",  # Last date
]

print("\n" + "="*80)
print("CROSS-ROLE PREDICTION CHECK (PREDICTED SCORE)")
print("="*80)
print(f"{'Date':<12} | {'DB Score':<10} | {'Student API':<12} | {'Faculty API':<12} | {'Admin API':<10} | {'Match?'}")
print("-" * 80)

all_scores_match = True
for d in test_dates:
    db_val = db_rows[d]["score"]
    s_val = student_map[d]["predicted_score"]
    f_val = faculty_map[d]["predicted_score"]
    a_val = admin_map[d]["predicted_score"]
    match = (round(db_val, 2) == round(s_val, 2) == round(f_val, 2) == round(a_val, 2))
    if not match:
        all_scores_match = False
    print(f"{d:<12} | {db_val:<10.2f} | {s_val:<12.2f} | {f_val:<12.2f} | {a_val:<10.2f} | {'PASS' if match else 'FAIL'}")

print("\n" + "="*80)
print("CROSS-ROLE RISK CHECK (RISK LEVEL)")
print("="*80)
print(f"{'Date':<12} | {'DB Risk':<10} | {'Student API':<12} | {'Faculty API':<12} | {'Admin API':<10} | {'Match?'}")
print("-" * 80)

all_risk_match = True
for d in test_dates:
    db_val = db_rows[d]["risk"].upper()
    s_val = student_map[d]["risk_level"].upper()
    f_val = faculty_map[d]["risk_level"].upper()
    a_val = admin_map[d]["risk_level"].upper()
    match = (db_val == s_val == f_val == a_val)
    if not match:
        all_risk_match = False
    print(f"{d:<12} | {db_val:<10} | {s_val:<12} | {f_val:<12} | {a_val:<10} | {'PASS' if match else 'FAIL'}")

print("\n" + "="*80)
print("CROSS-ROLE PASS PROBABILITY CHECK")
print("="*80)
print(f"{'Date':<12} | {'DB Pass Prob':<12} | {'Student API':<12} | {'Faculty API':<12} | {'Admin API':<12} | {'Match?'}")
print("-" * 80)

all_prob_match = True
for d in test_dates:
    db_val = db_rows[d]["pass_prob"]
    s_val = student_map[d]["pass_probability"]
    f_val = faculty_map[d]["pass_probability"]
    a_val = admin_map[d]["pass_probability"]
    match = (round(db_val, 4) == round(s_val, 4) == round(f_val, 4) == round(a_val, 4))
    if not match:
        all_prob_match = False
    print(f"{d:<12} | {db_val:<12.4f} | {s_val:<12.4f} | {f_val:<12.4f} | {a_val:<12.4f} | {'PASS' if match else 'FAIL'}")

print("\nSummary:")
print(f"All Scores Match: {all_scores_match}")
print(f"All Risks Match: {all_risk_match}")
print(f"All Pass Probabilities Match: {all_prob_match}")
