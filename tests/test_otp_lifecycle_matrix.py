import uuid
import time
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.database import SessionLocal
from backend.models.user import User
from backend.models.auth_tokens import EmailVerificationToken, PasswordResetToken
from backend.routers.auth import _hash_token
from backend.services.email_service import _dev_provider_instance

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_mock_email():
    """Ensure mock email provider is active for test suite."""
    orig_provider = settings.EMAIL_PROVIDER
    settings.EMAIL_PROVIDER = "mock"
    _dev_provider_instance.sent_emails.clear()
    yield
    settings.EMAIL_PROVIDER = orig_provider


def create_test_user_with_otp(email_prefix: str, role: str = "student", otp_code: str = "123456"):
    """Helper to create a user and an active OTP token in DB directly without real SMTP."""
    db = SessionLocal()
    email = f"{email_prefix}_{int(time.time()*1000)}@university.edu"
    user = User(
        email=email,
        full_name="OTP Test User",
        hashed_password="dummy_hashed_password_for_tests",
        role=role,
        is_active=True,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    now = datetime.now(timezone.utc)
    token_hash = _hash_token(otp_code)
    token = EmailVerificationToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + timedelta(minutes=5),
        max_attempts=5,
        attempt_count=0,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    user_id = user.id
    token_id = token.id
    db.close()
    return email, user_id, token_id


def create_test_reset_otp(email_prefix: str, otp_code: str = "123456"):
    """Helper to create an active password reset OTP token in DB."""
    db = SessionLocal()
    email = f"{email_prefix}_{int(time.time()*1000)}@university.edu"
    user = User(
        email=email,
        full_name="Reset OTP Test User",
        hashed_password="dummy_hashed_password_for_tests",
        role="student",
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    now = datetime.now(timezone.utc)
    token_hash = _hash_token(otp_code)
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + timedelta(minutes=5),
        max_attempts=5,
        attempt_count=0,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    user_id = user.id
    token_id = token.id
    db.close()
    return email, user_id, token_id


class TestOtpLifecycleMatrix:
    """Forensic verification of the OTP lifecycle across all scenarios."""

    def test_test_a_wrong_then_correct(self):
        """
        TEST A:
        OTP = 123456
        Enter wrong: 111111 -> exactly one request -> Invalid OTP (attempt 1)
        Enter correct: 123456 -> exactly one request -> SUCCESS (200 OK)
        """
        email, user_id, token_id = create_test_user_with_otp("test_a", "student", "123456")

        # Attempt 1: wrong OTP
        res1 = client.post("/api/auth/verify-email", json={"email": email, "otp": "111111"})
        assert res1.status_code == 400
        assert "INVALID_OTP" in res1.json()["detail"]

        # Check DB: token still active, attempt_count is 1
        db = SessionLocal()
        t1 = db.query(EmailVerificationToken).filter(EmailVerificationToken.id == token_id).first()
        assert t1.used_at is None, "Active OTP must NOT be consumed by wrong attempt"
        assert t1.attempt_count == 1, "Attempt count must increment exactly once"
        db.close()

        # Attempt 2: correct OTP
        res2 = client.post("/api/auth/verify-email", json={"email": email, "otp": "123456"})
        assert res2.status_code == 200
        data = res2.json()
        assert "access_token" in data
        assert data["is_email_verified"] is True

        # Check DB: token consumed
        db = SessionLocal()
        t2 = db.query(EmailVerificationToken).filter(EmailVerificationToken.id == token_id).first()
        assert t2.used_at is not None, "Token must be marked used upon successful verification"
        u = db.query(User).filter(User.id == user_id).first()
        assert u.is_email_verified is True
        db.close()

    def test_test_b_wrong_then_correct_then_repeat(self):
        """
        TEST B:
        wrong -> correct -> correct
        first fails, second succeeds, third returns already verified token
        """
        email, user_id, token_id = create_test_user_with_otp("test_b", "faculty", "654321")

        # 1. Wrong
        res1 = client.post("/api/auth/verify-email", json={"email": email, "otp": "000000"})
        assert res1.status_code == 400

        # 2. Correct
        res2 = client.post("/api/auth/verify-email", json={"email": email, "otp": "654321"})
        assert res2.status_code == 200

        # 3. Third request when already verified
        res3 = client.post("/api/auth/verify-email", json={"email": email, "otp": "654321"})
        assert res3.status_code == 200
        assert res3.json()["is_email_verified"] is True

    def test_test_c_wrong_change_digits_correct(self):
        """
        TEST C:
        wrong -> change digits -> correct -> succeeds
        """
        email, user_id, token_id = create_test_user_with_otp("test_c", "student", "888222")

        # Attempt 1: 111222
        res1 = client.post("/api/auth/verify-email", json={"email": email, "otp": "111222"})
        assert res1.status_code == 400

        # Attempt 2: 888222
        res2 = client.post("/api/auth/verify-email", json={"email": email, "otp": "888222"})
        assert res2.status_code == 200
        assert res2.json()["is_email_verified"] is True

    def test_test_d_multiple_wrong_then_correct(self):
        """
        TEST D:
        wrong -> wrong -> correct -> succeeds within max attempts limit (5)
        """
        email, user_id, token_id = create_test_user_with_otp("test_d", "student", "456789")

        # Wrong 1
        res1 = client.post("/api/auth/verify-email", json={"email": email, "otp": "100000"})
        assert res1.status_code == 400
        assert "4 attempt(s) remaining" in res1.json()["detail"]

        # Wrong 2
        res2 = client.post("/api/auth/verify-email", json={"email": email, "otp": "200000"})
        assert res2.status_code == 400
        assert "3 attempt(s) remaining" in res2.json()["detail"]

        # Wrong 3
        res3 = client.post("/api/auth/verify-email", json={"email": email, "otp": "300000"})
        assert res3.status_code == 400
        assert "2 attempt(s) remaining" in res3.json()["detail"]

        # Correct on attempt 4
        res4 = client.post("/api/auth/verify-email", json={"email": email, "otp": "456789"})
        assert res4.status_code == 200
        assert res4.json()["is_email_verified"] is True

    def test_test_e_resend_invalidates_old_otp(self):
        """
        TEST E:
        resend -> old OTP fails
        resend -> new OTP succeeds
        """
        email, user_id, old_token_id = create_test_user_with_otp("test_e", "student", "112233")

        # Request resend via API
        res_resend = client.post("/api/auth/resend-verification", json={"email": email})
        assert res_resend.status_code == 200

        # Check DB: old token is invalidated (used_at is not None)
        db = SessionLocal()
        old_tok = db.query(EmailVerificationToken).filter(EmailVerificationToken.id == old_token_id).first()
        assert old_tok.used_at is not None, "Resend must invalidate previous token"

        # Find newly generated token in DB
        new_tok = (
            db.query(EmailVerificationToken)
            .filter(EmailVerificationToken.user_id == user_id, EmailVerificationToken.used_at.is_(None))
            .first()
        )
        assert new_tok is not None, "New token must be generated"
        assert new_tok.id != old_token_id
        db.close()

        # Try verifying with OLD OTP -> must fail
        res_old = client.post("/api/auth/verify-email", json={"email": email, "otp": "112233"})
        assert res_old.status_code == 400

        # Check sent email in mock provider to get new OTP
        sent_emails = _dev_provider_instance.sent_emails
        assert len(sent_emails) > 0
        new_otp = sent_emails[-1]["otp"]

        # Verify with NEW OTP -> must succeed
        res_new = client.post("/api/auth/verify-email", json={"email": email, "otp": new_otp})
        assert res_new.status_code == 200
        assert res_new.json()["is_email_verified"] is True

    def test_reset_password_otp_wrong_then_correct(self):
        """
        Test Password Reset OTP flow:
        wrong OTP -> fails, attempt counter increments
        correct OTP -> succeeds, returns reset_token
        """
        email, user_id, token_id = create_test_reset_otp("test_reset", "987654")

        # Wrong attempt
        res1 = client.post("/api/auth/verify-reset-otp", json={"email": email, "otp": "000000"})
        assert res1.status_code == 400
        assert "INVALID_OTP" in res1.json()["detail"]

        # Correct attempt
        res2 = client.post("/api/auth/verify-reset-otp", json={"email": email, "otp": "987654"})
        assert res2.status_code == 200
        data = res2.json()
        assert data["status"] == "OTP_VERIFIED"
        assert "reset_token" in data
        assert len(data["reset_token"]) > 20
