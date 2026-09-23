import uuid
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.user import User
from backend.security import get_password_hash, create_access_token
from backend.services.rate_limiter import get_rate_limiter
from backend.config import settings

client = TestClient(app)

STUDENT_EMAIL = "iso.student@institution.edu"
FACULTY_EMAIL = "iso.faculty@institution.edu"
ADMIN_EMAIL = "iso.admin@institution.edu"
PASSWORD = "IsoPassword123!"

def get_captcha():
    return f"mock-turnstile-pass-{uuid.uuid4()}"

@pytest.fixture(scope="module", autouse=True)
def setup_test_users():
    """Ensure verified test accounts exist with clean baseline credentials."""
    db = SessionLocal()
    users_data = [
        (STUDENT_EMAIL, "student", "Isolation Student"),
        (FACULTY_EMAIL, "faculty", "Isolation Faculty"),
        (ADMIN_EMAIL, "admin", "Isolation Admin"),
    ]
    for email, role, full_name in users_data:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                hashed_password=get_password_hash(PASSWORD),
                full_name=full_name,
                role=role,
                is_active=True,
                is_email_verified=True,
                auth_provider="password",
            )
            db.add(u)
        else:
            u.role = role
            u.hashed_password = get_password_hash(PASSWORD)
            u.is_active = True
            u.is_email_verified = True
    db.commit()
    db.close()
    yield
    teardown_db = SessionLocal()
    try:
        for email, _, _ in users_data:
            teardown_db.query(User).filter(User.email == email).delete()
        teardown_db.commit()
    finally:
        teardown_db.close()


@pytest.fixture(autouse=True)
def clear_rate_limits():
    """Clear rate limiting windows between tests to prevent test pollution."""
    rl = get_rate_limiter()
    if hasattr(rl, "_ip_windows"):
        rl._ip_windows.clear()
    if hasattr(rl, "_login_failures"):
        rl._login_failures.clear()


# ========================================================
# 1. STUDENT LOGIN TESTS
# ========================================================

def test_student_login_accepts_student():
    """Student Login + student credentials -> SUCCESS (200), token role = 'student'."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/student/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "student"

    # 2. General endpoint with expected_role
    res_gen = client.post(
        "/api/auth/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "student"},
    )
    assert res_gen.status_code == 200
    assert res_gen.json()["role"] == "student"


def test_student_login_rejects_faculty():
    """Student Login + faculty credentials -> REJECT (401), no token, generic safe error."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/student/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" not in data
    assert data["detail"]["code"] == "INVALID_ACCOUNT_TYPE"
    assert data["detail"]["message"] == "These credentials cannot be used with this account type."

    # 2. General endpoint with expected_role="student"
    res_gen = client.post(
        "/api/auth/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "student"},
    )
    assert res_gen.status_code == 401
    assert res_gen.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


def test_student_login_rejects_admin():
    """Student Login + admin credentials -> REJECT (401), no token, generic safe error."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/student/login",
        json={"email": ADMIN_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" not in data
    assert data["detail"]["code"] == "INVALID_ACCOUNT_TYPE"
    assert data["detail"]["message"] == "These credentials cannot be used with this account type."

    # 2. General endpoint with expected_role="student"
    res_gen = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "student"},
    )
    assert res_gen.status_code == 401
    assert res_gen.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


# ========================================================
# 2. FACULTY LOGIN TESTS
# ========================================================

def test_faculty_login_accepts_faculty():
    """Faculty Login + faculty credentials -> SUCCESS (200), token role = 'faculty'."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/faculty/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "faculty"

    # 2. General endpoint with expected_role
    res_gen = client.post(
        "/api/auth/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "faculty"},
    )
    assert res_gen.status_code == 200
    assert res_gen.json()["role"] == "faculty"


def test_faculty_login_rejects_student():
    """Faculty Login + student credentials -> REJECT (401), no token, generic safe error."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/faculty/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" not in data
    assert data["detail"]["code"] == "INVALID_ACCOUNT_TYPE"
    assert data["detail"]["message"] == "These credentials cannot be used with this account type."

    # 2. General endpoint with expected_role="faculty"
    res_gen = client.post(
        "/api/auth/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "faculty"},
    )
    assert res_gen.status_code == 401
    assert res_gen.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


def test_faculty_login_rejects_admin():
    """Faculty Login + admin credentials -> REJECT (401), no token, generic safe error."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/faculty/login",
        json={"email": ADMIN_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" not in data
    assert data["detail"]["code"] == "INVALID_ACCOUNT_TYPE"
    assert data["detail"]["message"] == "These credentials cannot be used with this account type."

    # 2. General endpoint with expected_role="faculty"
    res_gen = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "faculty"},
    )
    assert res_gen.status_code == 401
    assert res_gen.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


# ========================================================
# 3. ADMIN LOGIN TESTS
# ========================================================

def test_admin_login_accepts_admin():
    """Admin Login + admin credentials -> SUCCESS (200), token role = 'admin'."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "admin"

    # 2. General endpoint with expected_role
    res_gen = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "admin"},
    )
    assert res_gen.status_code == 200
    assert res_gen.json()["role"] == "admin"


def test_admin_login_rejects_student():
    """Admin Login + student credentials -> REJECT (401), no token, generic safe error."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/admin/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" not in data
    assert data["detail"]["code"] == "INVALID_ACCOUNT_TYPE"
    assert data["detail"]["message"] == "These credentials cannot be used with this account type."

    # 2. General endpoint with expected_role="admin"
    res_gen = client.post(
        "/api/auth/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "admin"},
    )
    assert res_gen.status_code == 401
    assert res_gen.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


def test_admin_login_rejects_faculty():
    """Admin Login + faculty credentials -> REJECT (401), no token, generic safe error."""
    # 1. Dedicated endpoint
    res = client.post(
        "/api/auth/admin/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
    )
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" not in data
    assert data["detail"]["code"] == "INVALID_ACCOUNT_TYPE"
    assert data["detail"]["message"] == "These credentials cannot be used with this account type."

    # 2. General endpoint with expected_role="admin"
    res_gen = client.post(
        "/api/auth/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha(), "expected_role": "admin"},
    )
    assert res_gen.status_code == 401
    assert res_gen.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


# ========================================================
# 4. CROSS-ROLE PROTECTED API TESTS
# ========================================================

def test_cross_role_tokens_cannot_access_protected_routes():
    """Verify that RBAC strictly rejects cross-role access to protected APIs."""
    student_token = create_access_token({"sub": STUDENT_EMAIL, "role": "student"})
    faculty_token = create_access_token({"sub": FACULTY_EMAIL, "role": "faculty"})
    admin_token = create_access_token({"sub": ADMIN_EMAIL, "role": "admin"})

    headers_student = {"Authorization": f"Bearer {student_token}"}
    headers_faculty = {"Authorization": f"Bearer {faculty_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Student token -> faculty-only route
    res_s_to_f = client.get("/api/faculty/students", headers=headers_student)
    assert res_s_to_f.status_code == 403, f"Expected 403, got {res_s_to_f.status_code}"

    # Student token -> admin-only route
    res_s_to_a = client.get("/api/admin/overview", headers=headers_student)
    assert res_s_to_a.status_code == 403, f"Expected 403, got {res_s_to_a.status_code}"

    # Faculty token -> student-only route
    res_f_to_s = client.get("/api/students/profile", headers=headers_faculty)
    assert res_f_to_s.status_code == 403, f"Expected 403, got {res_f_to_s.status_code}"

    # Faculty token -> admin-only route
    res_f_to_a = client.get("/api/admin/overview", headers=headers_faculty)
    assert res_f_to_a.status_code == 403, f"Expected 403, got {res_f_to_a.status_code}"

    # Admin token -> admin route (permitted)
    res_a_to_a = client.get("/api/admin/overview", headers=headers_admin)
    assert res_a_to_a.status_code == 200, f"Expected 200, got {res_a_to_a.status_code}"


# ========================================================
# 5. STALE SESSION / PREVIOUS AUTHENTICATION TESTS
# ========================================================

def test_stale_session_cannot_change_login_role():
    """Verify that lingering headers/tokens from a prior session cannot alter or bypass login role enforcement."""
    # Simulate a user who had a valid faculty token in memory/headers
    faculty_token = create_access_token({"sub": FACULTY_EMAIL, "role": "faculty"})
    stale_headers = {"Authorization": f"Bearer {faculty_token}"}

    # Attemping to log in via Student Login with faculty credentials, even with faculty auth header
    res = client.post(
        "/api/auth/student/login",
        json={"email": FACULTY_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
        headers=stale_headers,
    )
    assert res.status_code == 401
    assert "access_token" not in res.json()
    assert res.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"

    # Attemping to log in via Faculty Login with student credentials, even with student auth header
    student_token = create_access_token({"sub": STUDENT_EMAIL, "role": "student"})
    stale_student_headers = {"Authorization": f"Bearer {student_token}"}
    res_fac = client.post(
        "/api/auth/faculty/login",
        json={"email": STUDENT_EMAIL, "password": PASSWORD, "captcha_token": get_captcha()},
        headers=stale_student_headers,
    )
    assert res_fac.status_code == 401
    assert "access_token" not in res_fac.json()
    assert res_fac.json()["detail"]["code"] == "INVALID_ACCOUNT_TYPE"


# ========================================================
# 6. INVALID CREDENTIALS ERROR PRESERVATION
# ========================================================

def test_invalid_password_preserves_standard_credential_error():
    """Verify that wrong password produces 'INVALID_CREDENTIALS' rather than account type error."""
    res = client.post(
        "/api/auth/student/login",
        json={"email": STUDENT_EMAIL, "password": "WrongPassword999!", "captcha_token": get_captcha()},
    )
    assert res.status_code == 401
    data = res.json()
    assert data["detail"]["code"] == "INVALID_CREDENTIALS"
    assert data["detail"]["message"] == "Incorrect email or password."
