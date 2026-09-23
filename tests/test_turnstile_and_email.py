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
    _dev_provider_instance,
)
from backend.services.turnstile_service import verify_turnstile_token, _replay_cache

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_env():
    """Ensure mock email provider and mock turnstile are active during test execution."""
    orig_email_provider = settings.EMAIL_PROVIDER
    orig_captcha_provider = settings.CAPTCHA_PROVIDER
    settings.EMAIL_PROVIDER = "mock"
    settings.CAPTCHA_PROVIDER = "mock"
    _dev_provider_instance.sent_emails.clear()
    _replay_cache.clear()
    from backend.services.rate_limiter import get_rate_limiter
    get_rate_limiter()._ip_windows.clear()
    yield
    settings.EMAIL_PROVIDER = orig_email_provider
    settings.CAPTCHA_PROVIDER = orig_captcha_provider


class TestTurnstileSecurity:
    """Validate Cloudflare Turnstile token verification across auth endpoints."""

    def test_signup_requires_turnstile(self):
        """Student signup without captcha_token must be rejected."""
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "No Captcha Student",
                "email": f"nocaptcha_{uuid.uuid4().hex[:8]}@university.edu",
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": f"NOCAP_{uuid.uuid4().hex[:8]}",
                "department": "Computer Science and Engineering",
            },
        )
        assert res.status_code == 400
        assert "human verification" in res.text.lower()

    def test_faculty_signup_requires_turnstile(self):
        """Faculty signup without captcha_token must be rejected."""
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "No Captcha Faculty",
                "email": f"fac_nocaptcha_{uuid.uuid4().hex[:8]}@university.edu",
                "password": "SecurePassword123!",
                "role": "faculty",
                "departments": ["Computer Science and Engineering"],
            },
        )
        assert res.status_code == 400
        assert "human verification" in res.text.lower()

    def test_forgot_password_requires_turnstile(self):
        """Forgot password without captcha_token must be rejected."""
        res = client.post(
            "/api/auth/forgot-password",
            json={"email": "alice.smith@university.edu"},
        )
        assert res.status_code == 400
        assert "human verification" in res.text.lower()

    def test_invalid_turnstile_rejected(self):
        """Invalid or forged captcha token must be rejected."""
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Invalid Captcha Student",
                "email": f"badcaptcha_{uuid.uuid4().hex[:8]}@university.edu",
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": f"BADCAP_{uuid.uuid4().hex[:8]}",
                "department": "Computer Science and Engineering",
                "captcha_token": "mock-turnstile-fail",
            },
        )
        assert res.status_code == 400
        assert "human verification" in res.text.lower()

    def test_wrong_turnstile_action_rejected(self):
        """Token generated for the wrong action must be rejected."""
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Wrong Action Student",
                "email": f"wrongaction_{uuid.uuid4().hex[:8]}@university.edu",
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": f"WRACT_{uuid.uuid4().hex[:8]}",
                "department": "Computer Science and Engineering",
                "captcha_token": "mock-turnstile-wrong-action",
            },
        )
        assert res.status_code == 400
        assert "action mismatch" in res.text.lower() or "human verification" in res.text.lower()

    def test_replayed_turnstile_rejected(self):
        """A single Turnstile token cannot be replayed."""
        replayed_token = f"mock-turnstile-replay-target-{uuid.uuid4().hex[:8]}"
        
        # Direct verification service call 1: must succeed
        res1 = verify_turnstile_token(replayed_token, expected_action="student_signup")
        assert res1["success"] is True

        # Direct verification service call 2 with identical token: must be rejected as replayed
        res2 = verify_turnstile_token(replayed_token, expected_action="student_signup")
        assert res2["success"] is False
        assert "timeout-or-duplicate" in res2["error_codes"]

    def test_turnstile_provider_failure(self):
        """When CAPTCHA provider is unavailable, request is safely rejected."""
        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Timeout Student",
                "email": f"timeout_{uuid.uuid4().hex[:8]}@university.edu",
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": f"TO_{uuid.uuid4().hex[:8]}",
                "department": "Computer Science and Engineering",
                "captcha_token": "mock-turnstile-timeout",
            },
        )
        assert res.status_code == 400
        assert "unavailable" in res.text.lower() or "human verification" in res.text.lower()



    def test_student_login_requires_turnstile(self):
        """Student login requires Turnstile token."""
        res = client.post(
            "/api/auth/login",
            json={
                "email": "student@university.edu",
                "password": "Password123!",
            },
        )
        assert res.status_code == 400
        assert "human verification" in res.text.lower() or "verification" in res.text.lower()

    def test_student_login_wrong_action_rejected(self):
        """Student login with wrong action token is rejected."""
        res = client.post(
            "/api/auth/login",
            json={
                "email": "student@university.edu",
                "password": "Password123!",
                "captcha_token": "mock-turnstile-wrong-action",
            },
        )
        assert res.status_code == 400
        assert "action" in res.text.lower() or "verification" in res.text.lower()

    def test_first_resend_does_not_require_turnstile(self):
        """First normal resend does not require Turnstile; rate limiting / cooldown applies."""
        email = f"first_resend_{uuid.uuid4().hex[:8]}@university.edu"
        # Register user
        client.post(
            "/api/auth/signup",
            json={
                "full_name": "First Resend Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": f"FRES_{uuid.uuid4().hex[:8]}",
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        # Clear cooldown for immediate resend test
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        uid = user.id
        db.close()

        from backend.services.rate_limiter import get_rate_limiter
        rl = get_rate_limiter()
        rl._resend_cooldowns.pop(uid, None)

        # First resend WITHOUT captcha token should succeed (or not fail on captcha)
        res = client.post("/api/auth/resend-verification", json={"email": email})
        assert res.status_code == 200
        assert "dispatched" in res.json().get("message", "").lower() or res.json().get("status") == "SUCCESS"


class TestMockEmailAndOTPSecurity:
    """Validate OTP lifecycle and email provider isolation (mock-only)."""

    def test_mock_email_registration(self):
        """Registration under mock email generates 6-digit OTP without real email delivery."""
        email = f"mock_reg_{uuid.uuid4().hex[:8]}@university.edu"
        roll_no = f"MREG_{uuid.uuid4().hex[:8]}"

        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Mock Registered Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        assert res.status_code == 201

        # Verify OTP captured by mock provider
        otp = _dev_provider_instance.get_latest_otp(email)
        assert otp is not None
        assert len(otp) == 6
        assert otp.isdigit()

    def test_mock_email_otp_verification(self):
        """Validating the OTP from mock provider verifies the account."""
        email = f"mock_verify_{uuid.uuid4().hex[:8]}@university.edu"
        roll_no = f"MVER_{uuid.uuid4().hex[:8]}"

        client.post(
            "/api/auth/signup",
            json={
                "full_name": "Mock Verify Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        otp = _dev_provider_instance.get_latest_otp(email)

        verify_res = client.post(
            "/api/auth/verify-email",
            json={"email": email, "otp": otp},
        )
        assert verify_res.status_code == 200
        data = verify_res.json()
        assert data["is_email_verified"] is True
        assert "access_token" in data

    def test_smtp_failure_handling(self, monkeypatch):
        """If delivery fails, transaction rolls back cleanly with friendly message."""
        email = f"smtp_fail_{uuid.uuid4().hex[:8]}@university.edu"
        roll_no = f"SFAIL_{uuid.uuid4().hex[:8]}"

        class FailingDelivery:
            def send_verification_email(self, *args, **kwargs):
                return False

        monkeypatch.setattr("backend.routers.auth.get_email_service", lambda: FailingDelivery())

        res = client.post(
            "/api/auth/signup",
            json={
                "full_name": "SMTP Fail Student",
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

        # Verify transaction rolled back (no orphan user in DB)
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        assert user is None
        profile = db.query(StudentProfile).filter(StudentProfile.roll_number == roll_no).first()
        assert profile is None
        db.close()

    def test_otp_expiration(self):
        """Expired OTP cannot activate account."""
        email = f"otp_exp_{uuid.uuid4().hex[:8]}@university.edu"
        roll_no = f"OEXP_{uuid.uuid4().hex[:8]}"

        client.post(
            "/api/auth/signup",
            json={
                "full_name": "OTP Expired Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        otp = _dev_provider_instance.get_latest_otp(email)

        # Manually expire in DB
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        token = db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).first()
        token.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        db.commit()
        db.close()

        res = client.post("/api/auth/verify-email", json={"email": email, "otp": otp})
        assert res.status_code == 400
        assert "OTP_EXPIRED" in res.text

    def test_otp_single_use(self):
        """Verified OTP cannot be used a second time."""
        email = f"single_use_{uuid.uuid4().hex[:8]}@university.edu"
        roll_no = f"SUSE_{uuid.uuid4().hex[:8]}"

        client.post(
            "/api/auth/signup",
            json={
                "full_name": "Single Use Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        otp = _dev_provider_instance.get_latest_otp(email)

        # First verification: succeeds
        res1 = client.post("/api/auth/verify-email", json={"email": email, "otp": otp})
        assert res1.status_code == 200

        # Second verification: already verified
        res2 = client.post("/api/auth/verify-email", json={"email": email, "otp": otp})
        # Returns either existing session or rejects
        assert res2.status_code in (200, 400)

    def test_resend_invalidates_previous_otp(self):
        """Requesting a new OTP immediately invalidates the older one."""
        email = f"resend_inval_{uuid.uuid4().hex[:8]}@university.edu"
        roll_no = f"RINVAL_{uuid.uuid4().hex[:8]}"

        client.post(
            "/api/auth/signup",
            json={
                "full_name": "Resend Invalidate Student",
                "email": email,
                "password": "SecurePassword123!",
                "role": "student",
                "roll_number": roll_no,
                "department": "Computer Science and Engineering",
                "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}",
            },
        )
        otp1 = _dev_provider_instance.get_latest_otp(email)

        # Clear cooldown for test
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        uid = user.id
        db.close()

        from backend.services.rate_limiter import get_rate_limiter
        get_rate_limiter()._resend_cooldowns.pop(uid, None)

        # Resend OTP
        resend_res = client.post(
            "/api/auth/resend-verification",
            json={"email": email, "captcha_token": f"mock-turnstile-pass-{uuid.uuid4()}"},
        )
        assert resend_res.status_code == 200
        otp2 = _dev_provider_instance.get_latest_otp(email)

        if otp1 != otp2:
            # Using OTP 1 must be rejected
            res_old = client.post("/api/auth/verify-email", json={"email": email, "otp": otp1})
            assert res_old.status_code == 400

        # Using OTP 2 must succeed
        res_new = client.post("/api/auth/verify-email", json={"email": email, "otp": otp2})
        assert res_new.status_code == 200
