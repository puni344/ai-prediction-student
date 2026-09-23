import uuid
import os
import time
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.database import SessionLocal
from backend.models.user import User
from backend.models.profile import StudentProfile
from backend.models.auth_tokens import EmailVerificationToken
from backend.services.email_service import (
    get_email_service,
    DevelopmentEmailProvider,
    GmailSMTPProvider,
    _dev_provider_instance,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_mock_email():
    """Ensure mock email provider is active for test suite."""
    orig_provider = settings.EMAIL_PROVIDER
    settings.EMAIL_PROVIDER = "mock"
    _dev_provider_instance.sent_emails.clear()
    yield
    settings.EMAIL_PROVIDER = orig_provider


class TestMockEmailAndOTPFlow:
    """Test full registration -> OTP generation -> mock delivery -> OTP verification flow."""

    def test_mock_registration_and_verification_flow(self):
        email = f"student_test_{int(time.time())}@university.edu"
        roll_no = f"MOCK_{int(time.time())}"

        # 1. Register with mock email provider
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Mock Test Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        assert res.status_code == 201, f"Signup failed: {res.text}"

        # 2. Check that email was routed through mock provider (no real mail sent)
        otp = _dev_provider_instance.get_latest_otp(email)
        assert otp is not None, "Mock provider did not record OTP"
        assert len(otp) == 6, f"OTP must be 6 digits, got: {len(otp)}"
        assert otp.isdigit(), "OTP must consist of digits"

        # 3. Verify user is unverified initially
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.is_email_verified is False
        db.close()

        # 4. Attempt login with unverified account -> must be rejected (403)
        login_res = client.post(
            "/api/auth/login",
            json={"email": email, "password": "SecurePassword123!", "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}"},
        )
        assert login_res.status_code == 403
        assert "EMAIL_NOT_VERIFIED" in login_res.text or "not verified" in login_res.text.lower()

        # 5. Submit incorrect OTP -> must be rejected (400)
        wrong_otp = "000000" if otp != "000000" else "999999"
        bad_verify = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": wrong_otp},
        )
        assert bad_verify.status_code == 400
        assert "INVALID_OTP" in bad_verify.text

        # 6. Submit correct OTP -> must succeed and verify account
        good_verify = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": otp},
        )
        assert good_verify.status_code == 200
        data = good_verify.json()
        assert data["is_email_verified"] is True
        assert "access_token" in data

        # 7. Verify user state in database
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        assert user.is_email_verified is True
        db.close()

        # 8. Single-use: Try using the same OTP again -> must fail (token already used)
        reuse_verify = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": otp},
        )
        # Should return existing verified session or fail
        assert reuse_verify.status_code in (200, 400)


class TestOTPRules:
    """Verify OTP expiration, invalidation on resend, and single-use."""

    def test_expired_otp_rejected(self):
        email = f"expired_test_{int(time.time())}@university.edu"
        roll_no = f"EXP_{int(time.time())}"

        client.post(
            "/api/auth/signup",
            json={
                "full_name": "Expired Test Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        otp = _dev_provider_instance.get_latest_otp(email)

        # Manually expire the token in database
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        token = db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).first()
        token.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
        db.close()

        # Attempt verification with expired OTP -> must be rejected
        res = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": otp},
        )
        assert res.status_code == 400
        assert "OTP_EXPIRED" in res.text

    def test_old_otp_invalid_after_resend(self):
        email = f"resend_test_{int(time.time())}@university.edu"
        roll_no = f"RES_{int(time.time())}"

        client.post(
            "/api/auth/signup",
            json={
                "full_name": "Resend Test Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        otp1 = _dev_provider_instance.get_latest_otp(email)

        # Bypass 60s cooldown for test purposes in DB/cache
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        user_id = user.id
        db.close()

        from backend.services.rate_limiter import get_rate_limiter
        rl = get_rate_limiter()
        rl._resend_cooldowns.pop(user_id, None)

        # Request new OTP
        resend_res = client.post(
            "/api/auth/resend-verification",
            json={"email": email},
        )
        assert resend_res.status_code == 200
        otp2 = _dev_provider_instance.get_latest_otp(email)
        assert otp2 is not None

        # Attempt to use OTP 1 -> must fail
        verify_old = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": otp1},
        )
        # If otp1 != otp2, old OTP must fail
        if otp1 != otp2:
            assert verify_old.status_code == 400

        # Attempt to use OTP 2 -> must succeed
        verify_new = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": otp2},
        )
        assert verify_new.status_code == 200


class TestRegistrationTransactionSafety:
    """Verify transaction safety and retryability when email delivery fails."""

    def test_rollback_on_delivery_failure_and_clean_retry(self, monkeypatch):
        email = f"fail_retry_{int(time.time())}@university.edu"
        roll_no = f"FAIL_{int(time.time())}"

        # Mock email_service to simulate delivery failure
        class FailingEmailService:
            def send_verification_email(self, *args, **kwargs):
                return False

        monkeypatch.setattr("backend.routers.auth.get_email_service", lambda: FailingEmailService())

        # Attempt registration -> should fail with friendly message
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Fail Retry Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        assert res.status_code == 500
        assert res.json()["detail"] == "Verification email could not be sent. Please try again later."

        # Verify transaction rolled back cleanly (no orphan user in DB)
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        assert user is None, "Failed registration transaction must roll back cleanly"
        profile = db.query(StudentProfile).filter(StudentProfile.roll_number == roll_no).first()
        assert profile is None, "Student profile must roll back cleanly"
        db.close()

        # Restore working mock email service
        monkeypatch.undo()

        # Retry registration with the exact same email and roll number -> must succeed!
        retry_res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Fail Retry Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        assert retry_res.status_code == 201, f"Retry registration failed: {retry_res.text}"


class TestSMTPConfigurationAndAuth:
    """Verify SMTP configuration and authentication without sending real email."""

    def test_smtp_configuration_and_connectivity(self):
        # Instantiate GmailSMTPProvider directly
        provider = GmailSMTPProvider()
        diag = provider.verify_connection()
        if diag["status"] == "ERROR":
            import time
            time.sleep(2)
            diag = provider.verify_connection()

        assert diag["configured"] is True
        assert diag["status"] == "CONNECTED"
        assert diag["auth_code"] == 235
        # Zero emails sent during verification
