"""Database engine and session configuration using SQLAlchemy 2.0."""
import sys
import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from backend.config import settings

logger = logging.getLogger(__name__)

# --- Production SQLite Guard ---
if settings.APP_ENV.lower() == "production" and settings.DATABASE_URL.startswith("sqlite://"):
    logger.critical(
        "FATAL: Production requires PostgreSQL. SQLite is not allowed in APP_ENV=production. "
        "Set DATABASE_URL to a PostgreSQL connection string."
    )
    print(
        "\n\nFATAL CONFIGURATION ERROR:\n"
        "  Production requires PostgreSQL. SQLite is not allowed in APP_ENV=production.\n"
        "  Set DATABASE_URL to a valid PostgreSQL connection string.\n",
        file=sys.stderr,
        flush=True,
    )
    sys.exit(1)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and ensure proper teardown."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
