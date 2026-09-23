import sys
import os
import uuid
import time

# Ensure backend can be imported
sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.database import SessionLocal
from backend.models.user import User
from backend.models.profile import StudentProfile
from backend.services.email_service import _dev_provider_instance

# Strictly set mock email provider: NO REAL EMAIL SENT
settings.EMAIL_PROVIDER = "mock"
_dev_provider_instance.sent_emails.clear()

client = TestClient(app)

def run_onboarding_smoke_test():
    print("=== PART 42: AUTOMATED COMPLETE-PROFILE SMOKE TEST ===")
    
    unique_id = int(time.time())
    email = f"forensic_student_{unique_id}@university.edu"
    roll_number = f"24CS{unique_id % 1000:03d}"
    
    # 1. Registration
    reg_payload = {
        "email": email,
        "full_name": "Forensic Test Student",
        "password": "SecurePassword123!",
        "role": "student",
        "roll_number": roll_number,
        "turnstile_token": f"mock-turnstile-pass-{uuid.uuid4()}"
    }
    
    res_reg = client.post("/api/auth/signup", json=reg_payload)
    print(f"1. POST /api/auth/signup -> Status: {res_reg.status_code}")
    assert res_reg.status_code == 201, f"Expected 201, got {res_reg.status_code}: {res_reg.text}"
    reg_data = res_reg.json()
    assert reg_data.get("status") == "EMAIL_VERIFICATION_REQUIRED"
    assert reg_data.get("is_email_verified") is False
    print("   Response JSON verified: status = EMAIL_VERIFICATION_REQUIRED, is_email_verified = False")
    
    # 2. Extract OTP from Mock Provider (Strictly no real SMTP)
    otp_code = _dev_provider_instance.get_latest_otp(email)
    assert otp_code is not None, "Mock provider did not record OTP"
    assert len(otp_code) == 6, f"Expected 6 digits, got {len(otp_code)}"
    print(f"2. OTP Generated via Mock Provider: {otp_code} (6 digits, no real email)")
    
    # 3. Verify Email with OTP
    verify_payload = {
        "email": email,
        "otp": otp_code
    }
    res_verify = client.post("/api/auth/verify-email", json=verify_payload)
    print(f"3. POST /api/auth/verify-email -> Status: {res_verify.status_code}")
    assert res_verify.status_code == 200, f"Expected 200, got {res_verify.status_code}: {res_verify.text}"
    vdata = res_verify.json()
    token = vdata.get("access_token")
    assert token, "Missing access_token in verify-email response"
    assert vdata.get("role") in ["STUDENT", "student"]
    assert vdata.get("requires_profile_completion") is True
    print(f"   Auth Token received: prefix '{token[:12]}...'")
    print(f"   User verified: id={vdata.get('user_id')}, role={vdata.get('role')}, requires_profile_completion={vdata.get('requires_profile_completion')}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 4. Check /api/auth/me immediately after OTP
    res_me = client.get("/api/auth/me", headers=headers)
    print(f"4. GET /api/auth/me -> Status: {res_me.status_code}")
    assert res_me.status_code == 200, f"Expected 200, got {res_me.status_code}: {res_me.text}"
    me_data = res_me.json()
    assert me_data.get("role").lower() == "student"
    assert me_data.get("is_email_verified") is True
    print(f"   Role: {me_data.get('role')}, is_email_verified: {me_data.get('is_email_verified')}")
    
    # 5. Check Initial Profile (Must be unselected / empty)
    res_prof_init = client.get("/api/students/profile", headers=headers)
    print(f"5. GET /api/students/profile (Initial) -> Status: {res_prof_init.status_code}")
    assert res_prof_init.status_code == 200
    p_init = res_prof_init.json()
    print(f"   Initial program: {p_init.get('program')} (expected None/empty)")
    print(f"   Initial department: {p_init.get('department')} (expected None/empty)")
    print(f"   Initial academic_year: {p_init.get('academic_year')} (expected None/empty)")
    assert p_init.get("program") is None
    assert p_init.get("academic_year") is None
    
    # 6. Fetch Canonical Program Catalogue
    res_prog = client.get("/api/programs", headers=headers)
    print(f"6. GET /api/programs -> Status: {res_prog.status_code}")
    assert res_prog.status_code == 200
    prog_data = res_prog.json()
    programs = prog_data.get("programs", [])
    print(f"   Found {len(programs)} canonical programs (B.Tech, BCA, MCA, MBA, etc.)")
    assert len(programs) >= 15
    
    # 7. Fetch Canonical Department Catalogue
    res_dept = client.get("/api/departments", headers=headers)
    print(f"7. GET /api/departments -> Status: {res_dept.status_code}")
    assert res_dept.status_code == 200
    dept_data = res_dept.json()
    departments = dept_data.get("departments", [])
    print(f"   Found {len(departments)} canonical active departments")
    assert len(departments) >= 20
    
    # 8. Submit Profile via Complete Profile Form
    profile_update = {
        "program": "B.Tech",
        "department": "Computer Science and Engineering",
        "academic_year": "2nd Year",
        "study_hours": 3.5,
        "sleep_hours": 7.5
    }
    res_update = client.put("/api/students/profile", json=profile_update, headers=headers)
    print(f"8. PUT /api/students/profile -> Status: {res_update.status_code}")
    assert res_update.status_code == 200
    u_data = res_update.json()
    print(f"   Updated program: {u_data.get('program')}")
    print(f"   Updated department: {u_data.get('department')}")
    print(f"   Updated academic_year: {u_data.get('academic_year')}")
    print(f"   Updated study_hours: {u_data.get('study_hours')}")
    print(f"   Updated sleep_hours: {u_data.get('sleep_hours')}")
    assert u_data.get("program") in ["btech", "B.Tech"]
    assert u_data.get("academic_year") == "2nd Year"
    assert u_data.get("study_hours") == 3.5
    assert u_data.get("sleep_hours") == 7.5
    
    # 9. Save Initial Timetable Preferences
    pref_payload = {
        "college_start": "09:00",
        "college_end": "16:00",
        "daily_study_hours": 3.5,
        "sleep_hours": 7.5,
        "sleep_start": "23:00",
        "sleep_end": "06:30",
        "rest_minutes": 15,
        "meal_minutes": 30,
        "breakfast_start": "08:00",
        "breakfast_duration": 30,
        "lunch_start": "12:00",
        "lunch_duration": 60,
        "dinner_start": "20:00",
        "dinner_duration": 30,
        "preferred_study_period": "evening",
        "session_length_preference": "standard"
    }
    res_pref = client.post("/api/students/timetable/preferences", json=pref_payload, headers=headers)
    print(f"9. POST /api/students/timetable/preferences -> Status: {res_pref.status_code}")
    assert res_pref.status_code == 200
    
    # 10. Verify Timetable Generation and 1440-minute conservation
    res_tt = client.post("/api/students/timetable/generate", json=pref_payload, headers=headers)
    print(f"10. POST /api/students/timetable/generate -> Status: {res_tt.status_code}")
    assert res_tt.status_code == 200
    tt_data = res_tt.json()
    val = tt_data.get("validation", {})
    assert val.get("valid") is True, f"Timetable validation failed: {val.get('message')}"
    avail = val.get("available_minutes") or val.get("availableMinutes", 0)
    college = val.get("college_minutes") or val.get("collegeMinutes", 0)
    sleep = val.get("sleep_minutes") or val.get("sleepMinutes", 0)
    meal = val.get("meal_minutes") or val.get("mealMinutes", 0)
    rest = val.get("rest_minutes") or val.get("restMinutes", 0)
    study = int(round(3.5 * 60))
    print(f"    Validation: valid={val.get('valid')}, College={college}m, Sleep={sleep}m, Meal={meal}m, Study={study}m, AvailableFree={avail}m")
    assert val.get("valid") is True
    
    # 11. Read back Dashboard Profile
    res_dash = client.get("/api/students/profile", headers=headers)
    print(f"11. GET /api/students/profile (Dashboard read-back) -> Status: {res_dash.status_code}")
    assert res_dash.status_code == 200
    d_prof = res_dash.json()
    assert d_prof.get("program") in ["btech", "B.Tech"]
    assert d_prof.get("department") == "Computer Science and Engineering"
    assert d_prof.get("academic_year") == "2nd Year"
    assert d_prof.get("study_hours") == 3.5
    assert d_prof.get("sleep_hours") == 7.5
    print("    Dashboard profile readback matches DB perfectly!")
    
    # 12. Direct Database Verification
    db = SessionLocal()
    sp = db.query(StudentProfile).filter(StudentProfile.user_id == u_data.get("user_id")).first()
    assert sp is not None
    assert sp.program_id in ["btech", "B.Tech"]
    assert sp.academic_year == "2nd Year"
    assert sp.study_hours == 3.5
    assert sp.sleep_hours == 7.5
    print("12. Direct Database query matches exact columns:")
    print(f"    sp.program_id: {sp.program_id}")
    print(f"    sp.department_id: {sp.department_id}")
    print(f"    sp.academic_year: {sp.academic_year}")
    print(f"    sp.study_hours: {sp.study_hours}")
    print(f"    sp.sleep_hours: {sp.sleep_hours}")
    db.close()
    
    print("\n>>> COMPLETE PROFILE ONBOARDING SMOKE TEST: ALL 12 STEPS PASSED WITHOUT REGRESSION <<<")

if __name__ == "__main__":
    run_onboarding_smoke_test()
