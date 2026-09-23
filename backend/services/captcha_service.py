"""CAPTCHA and bot protection service delegating to Cloudflare Turnstile."""
import logging
from typing import Optional
from backend.services.turnstile_service import verify_turnstile_token

logger = logging.getLogger(__name__)


def verify_captcha(
    token: Optional[str],
    ip_address: Optional[str] = None,
    expected_action: Optional[str] = None,
) -> bool:
    """Verify CAPTCHA token against Cloudflare Turnstile."""
    res = verify_turnstile_token(token, expected_action=expected_action, remote_ip=ip_address)
    return res["success"]
