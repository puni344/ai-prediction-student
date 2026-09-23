"""FastAPI application main entrypoint."""
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.database import engine, Base, get_db, SessionLocal
from backend.routers import auth, students, predictions, faculty, recommendations, chat, admin, calendar, timetable


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on application startup."""
    # --- Production configuration guard ---
    config_errors = settings.validate_production_config()
    if config_errors:
        for err in config_errors:
            logger.critical(f"FATAL CONFIG ERROR: {err}")
            print(f"\nFATAL CONFIG ERROR: {err}", file=sys.stderr, flush=True)
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    print("\n=== SMTP STARTUP DIAGNOSTIC ===", flush=True)
    print(f"SMTP username: {settings.SMTP_USERNAME}", flush=True)
    print(f"SMTP host: {settings.SMTP_HOST}", flush=True)
    print(f"SMTP port: {settings.SMTP_PORT}", flush=True)
    print(f"TLS enabled: {settings.SMTP_USE_TLS}", flush=True)
    print(f"password configured: {bool(settings.SMTP_PASSWORD)}", flush=True)
    print("================================\n", flush=True)
    # --- Academic Calendar startup sync ---
    try:
        from backend.services.academic_calendar.calendar_sync_service import startup_sync
        from backend.services.academic_calendar.holiday_api_client import HolidayAPIClient
        from backend.config import settings as cal_settings
        from datetime import datetime
        from zoneinfo import ZoneInfo

        cal_db = SessionLocal()
        try:
            client = HolidayAPIClient(
                api_key=cal_settings.HOLIDAY_API_KEY,
                base_url=cal_settings.HOLIDAY_API_BASE_URL,
                country=cal_settings.HOLIDAY_API_COUNTRY,
            )
            tz = ZoneInfo(cal_settings.ACADEMIC_TIMEZONE)
            current_year = datetime.now(tz).year
            sync_results = startup_sync(cal_db, client, current_year)
            print(f"\n=== ACADEMIC CALENDAR SYNC ===", flush=True)
            print(f"Results: {sync_results}", flush=True)
            print(f"==============================\n", flush=True)
        finally:
            cal_db.close()
    except Exception as e:
        print(f"\n=== CALENDAR SYNC WARNING: {e} ===\n", flush=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(students.router, prefix=settings.API_V1_STR)
app.include_router(predictions.router, prefix=settings.API_V1_STR)
app.include_router(faculty.router, prefix=settings.API_V1_STR)
app.include_router(recommendations.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(calendar.router, prefix=settings.API_V1_STR)
app.include_router(timetable.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": "AI-Driven Student Performance Prediction Platform API",
        "docs": f"{settings.API_V1_STR}/docs",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    """Backward-compatible health endpoint. Delegates to readiness check."""
    result = _check_readiness()
    status_code = 200 if result["status"] == "ready" else 503
    return JSONResponse(content=result, status_code=status_code)


@app.get("/health/live")
def health_live():
    """Liveness probe: application process is alive and responding."""
    return {"status": "alive"}


@app.get("/health/ready")
def health_ready():
    """Readiness probe: verifies database connectivity and ML model availability."""
    result = _check_readiness()
    status_code = 200 if result["status"] == "ready" else 503
    return JSONResponse(content=result, status_code=status_code)


def _check_readiness() -> dict:
    """Check critical runtime dependencies without expensive operations."""
    checks = {}
    all_ok = True

    # 1. Database connectivity
    try:
        db = SessionLocal()
        try:
            from sqlalchemy import text
            db.execute(text("SELECT 1"))
            checks["database"] = "ok"
        finally:
            db.close()
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"
        all_ok = False

    # 2. ML model artifacts available
    try:
        models_dir = Path(__file__).resolve().parents[1] / "models"
        regression_exists = (models_dir / "regression.pkl").exists()
        classifier_exists = (models_dir / "classifier.pkl").exists()
        metrics_exists = (models_dir / "metrics.json").exists()

        if regression_exists and classifier_exists and metrics_exists:
            checks["ml_models"] = "ok"
        else:
            missing = []
            if not regression_exists:
                missing.append("regression.pkl")
            if not classifier_exists:
                missing.append("classifier.pkl")
            if not metrics_exists:
                missing.append("metrics.json")
            checks["ml_models"] = f"missing: {', '.join(missing)}"
            all_ok = False
    except Exception as e:
        checks["ml_models"] = f"error: {str(e)[:100]}"
        all_ok = False

    return {
        "status": "ready" if all_ok else "not_ready",
        **checks,
    }


@app.get(f"{settings.API_V1_STR}/system/clock")
@app.get(f"{settings.API_V1_STR}/system/now")
def get_system_now():
    from backend.services.date_service import get_timezone, DEFAULT_TIMEZONE_STR
    from datetime import datetime, timezone

    tz = get_timezone(getattr(settings, "ACADEMIC_TIMEZONE", DEFAULT_TIMEZONE_STR))
    now_utc = datetime.now(timezone.utc)
    now_local = datetime.now(tz)

    return {
        "timezone": getattr(settings, "ACADEMIC_TIMEZONE", DEFAULT_TIMEZONE_STR),
        "utc_now": now_utc.isoformat(),
        "local_now": now_local.isoformat(),
        "local_date": now_local.strftime("%Y-%m-%d"),
        "local_time": now_local.strftime("%H:%M:%S"),
        "day_of_week": now_local.strftime("%A"),
        "current_year": now_local.year,
        "utc_timestamp": now_utc.isoformat(),
        "local_timestamp": now_local.isoformat(),
    }

@app.get(f"{settings.API_V1_STR}/system/email-mode")
def get_email_mode():
    provider = getattr(settings, "EMAIL_PROVIDER", "smtp").lower().strip()
    is_mock = provider in ("mock", "development", "test")
    return {
        "email_provider": provider,
        "is_mock": is_mock,
        "mode_notice": "Development email mode: no real email was sent." if is_mock else "SMTP active",
    }


@app.get(f"{settings.API_V1_STR}/programs")
def get_public_programs():
    """Retrieve centralized academic programs catalogue with duration and valid year options."""
    from backend.constants.programs import PROGRAMS, get_year_options_for_program
    enriched = [
        {
            **p,
            "year_options": get_year_options_for_program(p["id"]),
        }
        for p in PROGRAMS
    ]
    return {"programs": enriched}


@app.get(f"{settings.API_V1_STR}/departments")
def get_public_departments(db: Session = Depends(get_db)):
    """Retrieve centralized canonical academic departments catalogue from database."""
    from backend.models.department import Department
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
    return {
        "departments": [
            {
                "id": str(d.id),
                "name": d.name,
                "code": d.code,
                "is_active": d.is_active,
            }
            for d in depts
        ]
    }
