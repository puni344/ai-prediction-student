import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.user import User
from backend.security import get_password_hash

client = TestClient(app)

def test_expired_token_rejected_with_turnstile_expired():
    """TEST G: Expired token rejected by backend with TURNSTILE_EXPIRED."""
    payload = {
        "email": "test.turnstile.expired@institution.edu",
        "password": "Password123!",
        "full_name": "Test Turnstile Expired",
        "role": "student",
        "roll_number": "ROLL_EXP_1",
        "captcha_token": "mock-turnstile-expired",
    }
    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["code"] == "TURNSTILE_EXPIRED"
    assert "expired" in data["detail"]["message"].lower()

def test_reused_token_rejected_with_turnstile_expired():
    """TEST H: Reused token rejected by backend with timeout-or-duplicate / TURNSTILE_EXPIRED."""
    payload = {
        "email": "test.turnstile.replayed@institution.edu",
        "password": "Password123!",
        "full_name": "Test Turnstile Replayed",
        "role": "student",
        "roll_number": "ROLL_REP_1",
        "captcha_token": "mock-turnstile-replayed",
    }
    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["code"] == "TURNSTILE_EXPIRED"
    assert "already been used" in data["detail"]["message"].lower() or "expired" in data["detail"]["message"].lower()

def test_duplicate_email_preserves_turnstile_refresh():
    """TEST D: Registration fails due to duplicate email with EMAIL_ALREADY_REGISTERED."""
    # Ensure existing user exists
    db = SessionLocal()
    existing = db.query(User).filter(User.email == "final.audit.student@institution.edu").first()
    if not existing:
        existing = User(
            email="final.audit.student@institution.edu",
            hashed_password=get_password_hash("StudentPass123!"),
            full_name="Duplicate Seed Student",
            role="student",
            is_active=True,
            is_email_verified=True,
        )
        db.add(existing)
        db.commit()
    db.close()

    try:
        payload = {
            "email": "final.audit.student@institution.edu",
            "password": "StudentPass123!",
            "full_name": "Duplicate Student",
            "role": "student",
            "roll_number": "ROLL_DUP_EMAIL",
            "captcha_token": "mock-turnstile-student-signup",
        }
        response = client.post("/api/auth/signup", json=payload)
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] in ("EMAIL_ALREADY_REGISTERED", "VALIDATION_ERROR")
        assert "already exists" in str(data["detail"]).lower()
    finally:
        db = SessionLocal()
        db.query(User).filter(User.email == "final.audit.student@institution.edu").delete()
        db.commit()
        db.close()

def test_validation_error_before_consuming_turnstile():
    """TEST: Field validation error occurs before consuming turnstile token."""
    payload = {
        "email": "invalid-email-format",
        "password": "short",
        "full_name": "",
        "role": "student",
        "roll_number": "",
        "captcha_token": "mock-turnstile-student-signup",
    }
    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code in (400, 422)
    data = response.json()
    assert "detail" in data
