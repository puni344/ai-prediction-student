from pathlib import Path
"""Application configuration settings."""
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Driven Student Performance Prediction Platform"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "super-secret-jwt-key-for-development-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    DATABASE_URL: str = f"sqlite:///{(Path(__file__).resolve().parent.parent / 'student_performance.db').as_posix()}"
    AI_PROVIDER: str = "development"
    AI_MODEL: str = "gemini-2.5-flash"
    AI_BASE_URL: str | None = "https://generativelanguage.googleapis.com/v1beta/openai/"
    AI_API_KEY: str | None = None
    AI_TEMPERATURE: float = 0.3
    APP_ENV: str = "development"

    # Email / SMTP Settings
    EMAIL_PROVIDER: str = "smtp"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = "smartstudyreminder.ai@gmail.com"
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True
    EMAIL_FROM_NAME: str = "Smart Study Reminder"
    EMAIL_FROM_ADDRESS: str = "smartstudyreminder.ai@gmail.com"
    BREVO_API_KEY: str | None = None
    # Google Sign-In Settings
    GOOGLE_CLIENT_ID: str | None = None

    # CAPTCHA / Cloudflare Turnstile Settings
    ALLOWED_HOST: str | None = None
    CAPTCHA_PROVIDER: str = "turnstile"
    CAPTCHA_SITE_KEY: str | None = None
    CAPTCHA_SECRET_KEY: str | None = None
    TURNSTILE_SITE_KEY: str | None = None
    TURNSTILE_SECRET_KEY: str | None = None
    TURNSTILE_VERIFY_URL: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    # OTP Policy Settings
    OTP_EXPIRY_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # Administrator Settings
    ADMIN_EMAIL: str = "admin@institution.edu"
    # ADMIN_PASSWORD removed: admin password must never be stored in source code.
    # Use the deployment reset script to generate and hash a secure password.

    # Academic Calendar / Calendarific API Settings
    CALENDARIFIC_API_KEY: str | None = None
    CALENDARIFIC_BASE_URL: str = "https://calendarific.com/api/v2"
    CALENDARIFIC_COUNTRY: str = "IN"
    CALENDARIFIC_LOCATION: str = "in-ap"
    # Deprecated fallback for backward compatibility
    HOLIDAY_API_KEY: str | None = None
    HOLIDAY_API_BASE_URL: str = "https://holidayapi.com/v1"
    HOLIDAY_API_COUNTRY: str = "IN-AP"
    ACADEMIC_TIMEZONE: str = "Asia/Kolkata"
    ACADEMIC_CALENDAR_SYNC_HOUR: int = 2
    ACADEMIC_CALENDAR_SYNC_MINUTE: int = 10

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS from comma-separated string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "extra": "ignore",
    }

    def validate_production_config(self) -> list[str]:
        """Validate configuration for production deployment. Returns list of errors."""
        errors = []
        if self.APP_ENV.lower() == "production":
            # SQLite is not allowed in production
            if self.DATABASE_URL.startswith("sqlite://"):
                errors.append(
                    "Production requires PostgreSQL. SQLite is not allowed in APP_ENV=production. "
                    "Set DATABASE_URL to a PostgreSQL connection string."
                )
            # CORS must be explicitly configured (not localhost-only)
            if not self.CORS_ORIGINS:
                errors.append(
                    "CORS_ORIGINS must be explicitly configured in production. "
                    "Set CORS_ORIGINS to your deployed frontend origins."
                )
            else:
                all_localhost = all(
                    "localhost" in o or "127.0.0.1" in o
                    for o in self.CORS_ORIGINS
                )
                if all_localhost:
                    errors.append(
                        "CORS_ORIGINS contains only localhost origins. "
                        "Production must include the deployed frontend HTTPS origin."
                    )
        return errors


settings = Settings()
