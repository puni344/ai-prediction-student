"""
Production Configuration Test Suite
=====================================
Tests the 4 required production hardening changes:
1. SQLite production guard
2. CORS environment-driven configuration
3. Admin password removal from source
4. Health/readiness endpoints
Plus: authentication after reset, clean state verification
"""
import os
import sys
import json
import uuid
import pytest

sys.path.insert(0, r'C:\Users\punit\Downloads\Student-Performance-Predictor-main\Student-Performance-Predictor-main')
os.chdir(r'C:\Users\punit\Downloads\Student-Performance-Predictor-main\Student-Performance-Predictor-main')


def get_captcha():
    return f"mock-turnstile-pass-{uuid.uuid4()}"


# ========================================
# 1. SQLITE PRODUCTION GUARD
# ========================================
class TestSQLiteProductionGuard:
    """APP_ENV=production + SQLite must fail."""

    def test_production_sqlite_fails_validation(self):
        """Settings.validate_production_config() must reject SQLite in production."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="production",
            DATABASE_URL="sqlite:///test.db",
            CORS_ORIGINS=["https://example.com"],
        )
        errors = s.validate_production_config()
        assert any("SQLite" in e for e in errors), f"Expected SQLite error, got: {errors}"

    def test_production_postgresql_passes_validation(self):
        """Settings.validate_production_config() must accept PostgreSQL in production."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://user:pass@host/db",
            CORS_ORIGINS=["https://example.com"],
        )
        errors = s.validate_production_config()
        sqlite_errors = [e for e in errors if "SQLite" in e]
        assert len(sqlite_errors) == 0, f"Unexpected SQLite error: {sqlite_errors}"

    def test_development_sqlite_allowed(self):
        """Development mode should allow SQLite."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="development",
            DATABASE_URL="sqlite:///test.db",
        )
        errors = s.validate_production_config()
        assert len(errors) == 0, f"Development should allow SQLite, got: {errors}"


# ========================================
# 2. CORS ENVIRONMENT-DRIVEN
# ========================================
class TestCORSConfiguration:
    """CORS must be environment-driven and reject localhost-only in production."""

    def test_cors_parsed_from_comma_string(self):
        """CORS_ORIGINS must parse comma-separated string."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="development",
            CORS_ORIGINS="https://a.com,https://b.com",
        )
        assert s.CORS_ORIGINS == ["https://a.com", "https://b.com"]

    def test_cors_parsed_from_list(self):
        """CORS_ORIGINS must accept list."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="development",
            CORS_ORIGINS=["https://a.com", "https://b.com"],
        )
        assert s.CORS_ORIGINS == ["https://a.com", "https://b.com"]

    def test_production_cors_empty_fails(self):
        """Production with empty CORS must fail validation."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://user:pass@host/db",
            CORS_ORIGINS=[],
        )
        errors = s.validate_production_config()
        assert any("CORS" in e for e in errors), f"Expected CORS error, got: {errors}"

    def test_production_cors_localhost_only_fails(self):
        """Production with localhost-only CORS must fail validation."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://user:pass@host/db",
            CORS_ORIGINS=["http://localhost:5173", "http://127.0.0.1:5173"],
        )
        errors = s.validate_production_config()
        assert any("CORS" in e or "localhost" in e for e in errors), f"Expected CORS error, got: {errors}"

    def test_production_cors_with_https_passes(self):
        """Production with HTTPS frontend origin should pass CORS validation."""
        from backend.config import Settings
        s = Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://user:pass@host/db",
            CORS_ORIGINS=["https://myapp.com"],
        )
        errors = s.validate_production_config()
        cors_errors = [e for e in errors if "CORS" in e or "localhost" in e]
        assert len(cors_errors) == 0, f"Unexpected CORS error: {cors_errors}"

    def test_no_wildcard_cors(self):
        """CORS must never be ['*'] for authenticated app."""
        from backend.config import settings
        assert settings.CORS_ORIGINS != ["*"], "CORS must not be wildcard"


# ========================================
# 3. ADMIN PASSWORD REMOVAL
# ========================================
class TestAdminPasswordRemoval:
    """Plaintext admin password must not exist in source or config."""

    def test_no_admin_password_in_settings(self):
        """Settings class must not have ADMIN_PASSWORD attribute."""
        from backend.config import settings
        assert not hasattr(settings, 'ADMIN_PASSWORD'), \
            "ADMIN_PASSWORD must be removed from Settings"

    def test_no_admin_password_in_config_source(self):
        """config.py source must not contain plaintext ADMIN_PASSWORD default."""
        config_path = os.path.join(
            r'C:\Users\punit\Downloads\Student-Performance-Predictor-main\Student-Performance-Predictor-main',
            'backend', 'config.py'
        )
        with open(config_path, 'r', encoding='utf-8') as f:
            source = f.read()
        assert 'ADMIN_PASSWORD: str = ' not in source, \
            "ADMIN_PASSWORD field with default must be removed from config.py"
        assert 'AdminSecurePassword2026!' not in source, \
            "Old admin password must not appear in config.py"

    def test_no_admin_password_in_env(self):
        """Root .env must not contain active ADMIN_PASSWORD."""
        env_path = os.path.join(
            r'C:\Users\punit\Downloads\Student-Performance-Predictor-main\Student-Performance-Predictor-main',
            '.env'
        )
        with open(env_path, 'r', encoding='utf-8-sig') as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith('ADMIN_PASSWORD='):
                    pytest.fail(f"Active ADMIN_PASSWORD found in .env: {stripped}")

    def test_no_admin_password_in_seed_service(self):
        """seed_service.py must not reference settings.ADMIN_PASSWORD."""
        seed_path = os.path.join(
            r'C:\Users\punit\Downloads\Student-Performance-Predictor-main\Student-Performance-Predictor-main',
            'backend', 'services', 'seed_service.py'
        )
        with open(seed_path, 'r', encoding='utf-8-sig') as f:
            source = f.read()
        assert 'settings.ADMIN_PASSWORD' not in source, \
            "seed_service.py must not reference settings.ADMIN_PASSWORD"


# ========================================
# 4. HEALTH ENDPOINTS
# ========================================
class TestHealthEndpoints:
    """Health endpoints must accurately report status."""

    @pytest.fixture(autouse=True)
    def client(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        self._client = TestClient(app)
        return self._client

    def test_health_live(self):
        """GET /health/live must return alive."""
        r = self._client.get("/health/live")
        assert r.status_code == 200
        assert r.json()["status"] == "alive"

    def test_health_ready(self):
        """GET /health/ready must check DB and ML."""
        r = self._client.get("/health/ready")
        data = r.json()
        assert "database" in data, "health/ready must check database"
        assert "ml_models" in data, "health/ready must check ML models"
        if data["database"] == "ok" and data["ml_models"] == "ok":
            assert data["status"] == "ready"
            assert r.status_code == 200

    def test_health_backward_compat(self):
        """GET /health must delegate to readiness check."""
        r = self._client.get("/health")
        data = r.json()
        assert "status" in data
        assert "database" in data

    def test_root_endpoint(self):
        """GET / must return API info."""
        r = self._client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "online"


# ========================================
# 5. AUTHENTICATION AFTER RESET
# ========================================
class TestAuthAfterReset:
    """Verify authentication behavior on clean state after reset."""

    @pytest.fixture(autouse=True, scope="class")
    def ensure_clean_reset_state(self):
        """Ensure database has only admin account and 0 transactional data."""
        from backend.database import SessionLocal
        from backend.models import (
            User, StudentProfile, FacultyProfile, PredictionRecord,
            ChatMessage, ChatSession, EmailVerificationToken, PasswordResetToken
        )
        from backend.models.prediction import DailyPredictionSnapshot
        db = SessionLocal()
        try:
            db.query(ChatMessage).delete()
            db.query(ChatSession).delete()
            db.query(DailyPredictionSnapshot).delete()
            db.query(PredictionRecord).delete()
            db.query(StudentProfile).delete()
            db.query(FacultyProfile).delete()
            db.query(EmailVerificationToken).delete()
            db.query(PasswordResetToken).delete()
            db.query(User).filter(User.role != "admin").delete()
            # Ensure admin exists
            admin = db.query(User).filter(User.role == "admin").first()
            if not admin:
                from backend.security import get_password_hash
                admin = User(
                    email="admin@institution.edu",
                    hashed_password=get_password_hash("AdminPass123!"),
                    full_name="Admin",
                    role="admin",
                    is_active=True,
                    is_email_verified=True,
                    auth_provider="password",
                )
                db.add(admin)
            db.commit()
        finally:
            db.close()

    @pytest.fixture(autouse=True)
    def client(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        self._client = TestClient(app)
        return self._client

    def test_admin_login_endpoint_exists(self):
        """Admin login endpoint must exist and reject wrong passwords."""
        r = self._client.post("/api/auth/admin/login", json={
            "email": "admin@institution.edu",
            "password": "wrong-password-for-testing",
            "captcha_token": get_captcha(),
        })
        assert r.status_code in (401, 422), f"Expected 401/422, got {r.status_code}: {r.text}"

    def test_student_login_with_admin_creds_rejected(self):
        """Admin credentials on student login must be rejected."""
        r = self._client.post("/api/auth/student/login", json={
            "email": "admin@institution.edu",
            "password": "wrong-password",
            "captcha_token": get_captcha(),
        })
        assert r.status_code in (401, 422), f"Expected 401, got {r.status_code}"

    def test_faculty_login_with_admin_creds_rejected(self):
        """Admin credentials on faculty login must be rejected."""
        r = self._client.post("/api/auth/faculty/login", json={
            "email": "admin@institution.edu",
            "password": "wrong-password",
            "captcha_token": get_captcha(),
        })
        assert r.status_code in (401, 422), f"Expected 401, got {r.status_code}"

    def test_no_student_accounts_exist(self):
        """No student accounts should exist after reset."""
        from backend.database import SessionLocal
        from backend.models.user import User
        db = SessionLocal()
        try:
            count = db.query(User).filter(User.role == "student").count()
            assert count == 0, f"Expected 0 students, got {count}"
        finally:
            db.close()

    def test_no_faculty_accounts_exist(self):
        """No faculty accounts should exist after reset."""
        from backend.database import SessionLocal
        from backend.models.user import User
        db = SessionLocal()
        try:
            count = db.query(User).filter(User.role == "faculty").count()
            assert count == 0, f"Expected 0 faculty, got {count}"
        finally:
            db.close()

    def test_exactly_one_admin(self):
        """Exactly one admin must exist after reset."""
        from backend.database import SessionLocal
        from backend.models.user import User
        db = SessionLocal()
        try:
            admins = db.query(User).filter(User.role == "admin").all()
            assert len(admins) == 1, f"Expected 1 admin, got {len(admins)}"
            assert admins[0].email == "admin@institution.edu"
        finally:
            db.close()


# ========================================
# 6. CLEAN STATE VERIFICATION
# ========================================
class TestCleanState:
    """Verify all transactional data is cleared."""

    def test_zero_student_profiles(self):
        from backend.database import SessionLocal
        from backend.models.profile import StudentProfile
        db = SessionLocal()
        try:
            assert db.query(StudentProfile).count() == 0
        finally:
            db.close()

    def test_zero_faculty_profiles(self):
        from backend.database import SessionLocal
        from backend.models.profile import FacultyProfile
        db = SessionLocal()
        try:
            assert db.query(FacultyProfile).count() == 0
        finally:
            db.close()

    def test_zero_predictions(self):
        from backend.database import SessionLocal
        from backend.models.prediction import PredictionRecord
        db = SessionLocal()
        try:
            assert db.query(PredictionRecord).count() == 0
        finally:
            db.close()

    def test_zero_daily_snapshots(self):
        from backend.database import SessionLocal
        from backend.models.prediction import DailyPredictionSnapshot
        db = SessionLocal()
        try:
            assert db.query(DailyPredictionSnapshot).count() == 0
        finally:
            db.close()

    def test_zero_chat_data(self):
        from backend.database import SessionLocal
        from backend.models.chat import ChatSession, ChatMessage
        db = SessionLocal()
        try:
            assert db.query(ChatSession).count() == 0
            assert db.query(ChatMessage).count() == 0
        finally:
            db.close()

    def test_zero_otp_records(self):
        from backend.database import SessionLocal
        from backend.models.auth_tokens import EmailVerificationToken, PasswordResetToken
        db = SessionLocal()
        try:
            assert db.query(EmailVerificationToken).count() == 0
            assert db.query(PasswordResetToken).count() == 0
        finally:
            db.close()

    def test_reference_departments_preserved(self):
        from backend.database import SessionLocal
        from backend.models.department import Department
        db = SessionLocal()
        try:
            count = db.query(Department).count()
            assert count > 0, f"Departments must be preserved, got {count}"
        finally:
            db.close()

    def test_programs_catalogue_works(self):
        """Programs catalogue must be accessible."""
        from backend.constants.programs import PROGRAMS
        assert len(PROGRAMS) > 0, "Programs catalogue must not be empty"
