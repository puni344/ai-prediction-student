"""Security audit logger."""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from backend.models.auth_tokens import SecurityAuditLog

logger = logging.getLogger(__name__)


def log_security_event(
    db: Session,
    event_type: str,
    user_id: Optional[int] = None,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[str] = None,
):
    """Record an authentication security event in the database and structured logs."""
    try:
        log_entry = SecurityAuditLog(
            user_id=user_id,
            email=email,
            event_type=event_type,
            ip_address=ip_address,
            details=details,
        )
        db.add(log_entry)
        db.commit()
        logger.info(f"[SECURITY AUDIT] Event: {event_type} | User: {user_id or 'anonymous'} | Email: {email or 'none'} | IP: {ip_address or 'unknown'}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record security audit log: {e}")
