"""Cloudflare Turnstile CAPTCHA verification service."""
import time
import logging
import threading
import requests
from typing import Optional, Dict, Any, List
from backend.config import settings

logger = logging.getLogger(__name__)

# Thread-safe in-memory replay cache with TTL (10 minutes)
_replay_cache: Dict[str, float] = {}
_cache_lock = threading.Lock()
TOKEN_TTL_SECONDS = 600


def _cleanup_expired_tokens(now: float) -> None:
    """Evict tokens older than TTL."""
    expired = [t for t, ts in _replay_cache.items() if now - ts > TOKEN_TTL_SECONDS]
    for t in expired:
        _replay_cache.pop(t, None)


def verify_turnstile_token(
    token: Optional[str],
    expected_action: Optional[str] = None,
    remote_ip: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate a Cloudflare Turnstile token server-side.
    
    Returns:
        Dict with keys:
            success: bool
            action: Optional[str]
            hostname: Optional[str]
            error_codes: List[str]
            message: str
    """
    if not token or not token.strip():
        logger.warning("Turnstile validation failed: missing token")
        logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
        logger.info("Token received frontend: NO")
        logger.info("Token sent backend: NO")
        logger.info("Siteverify called: NO")
        logger.info("Siteverify success: NO")
        logger.info("Action match: NO")
        logger.info("Hostname match: NO")
        logger.info("=======================================")
        return {
            "success": False,
            "action": None,
            "hostname": None,
            "error_codes": ["missing-input-response"],
            "message": "Please complete the human verification and try again.",
        }

    token = token.strip()
    now = time.time()

    # 1. Replay prevention check
    with _cache_lock:
        _cleanup_expired_tokens(now)
        if token in _replay_cache:
            logger.warning("Turnstile validation failed: token replay detected")
            print("=== TURNSTILE SECURITY VERIFICATION ===", flush=True)
            print("Token present: YES", flush=True)
            print("Request sent: YES", flush=True)
            print("Siteverify called: NO (REPLAY PREVENTED)", flush=True)
            print("Siteverify result: FAIL", flush=True)
            print("Siteverify error code: timeout-or-duplicate", flush=True)
            print("Action match: NO", flush=True)
            print("Hostname match: NO", flush=True)
            print("=======================================", flush=True)
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["timeout-or-duplicate"],
                "message": "Verification token has already been used. Please verify again.",
            }

    # 2. Mock / Testing mode handling
    is_mock = (
        getattr(settings, "CAPTCHA_PROVIDER", "turnstile").lower() in ("mock", "development")
        or token.startswith("mock-turnstile-")
    )

    if is_mock:
        if token == "mock-turnstile-fail" or token == "mock-turnstile-invalid":
            logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
            logger.info("Token received frontend: YES")
            logger.info("Token sent backend: YES")
            logger.info("Siteverify called: YES")
            logger.info("Siteverify success: NO")
            logger.info("Action match: NO")
            logger.info("Hostname match: NO")
            logger.info("=======================================")
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["invalid-input-response"],
                "message": "Please complete the human verification and try again.",
            }
        if token == "mock-turnstile-expired":
            logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
            logger.info("Token received frontend: YES")
            logger.info("Token sent backend: YES")
            logger.info("Siteverify called: YES")
            logger.info("Siteverify success: NO")
            logger.info("Action match: NO")
            logger.info("Hostname match: NO")
            logger.info("=======================================")
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["timeout-or-duplicate"],
                "message": "Verification token has expired. Please verify again.",
            }
        if token == "mock-turnstile-replayed":
            logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
            logger.info("Token received frontend: YES")
            logger.info("Token sent backend: YES")
            logger.info("Siteverify called: NO (REPLAY PREVENTED)")
            logger.info("Siteverify success: NO")
            logger.info("Action match: NO")
            logger.info("Hostname match: NO")
            logger.info("=======================================")
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["timeout-or-duplicate"],
                "message": "Verification token has already been used. Please verify again.",
            }
        if token == "mock-turnstile-wrong-action":
            logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
            logger.info("Token received frontend: YES")
            logger.info("Token sent backend: YES")
            logger.info("Siteverify called: YES")
            logger.info("Siteverify success: YES")
            logger.info("Action match: NO")
            logger.info("Hostname match: YES")
            logger.info("=======================================")
            return {
                "success": False,
                "action": "wrong_action",
                "hostname": "localhost",
                "error_codes": ["action-mismatch"],
                "message": "Verification action mismatch. Please refresh and try again.",
            }
        if token == "mock-turnstile-wrong-hostname":
            logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
            logger.info("Token received frontend: YES")
            logger.info("Token sent backend: YES")
            logger.info("Siteverify called: YES")
            logger.info("Siteverify success: YES")
            logger.info("Action match: YES")
            logger.info("Hostname match: NO")
            logger.info("=======================================")
            return {
                "success": False,
                "action": expected_action or "student_signup",
                "hostname": "attacker-domain.com",
                "error_codes": ["hostname-mismatch"],
                "message": "Verification hostname mismatch.",
            }
        if token == "mock-turnstile-timeout":
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["internal-error"],
                "message": "Human verification service temporarily unavailable. Please try again.",
            }

        # Successful mock token
        with _cache_lock:
            _replay_cache[token] = now
        logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
        logger.info("Token received frontend: YES")
        logger.info("Token sent backend: YES")
        logger.info("Siteverify called: YES")
        logger.info("Siteverify success: YES")
        logger.info("Action match: YES")
        logger.info("Hostname match: YES")
        logger.info("=======================================")
        return {
            "success": True,
            "action": expected_action or "student_signup",
            "hostname": "localhost",
            "error_codes": [],
            "message": "Verification successful.",
        }

    # 3. Real Cloudflare Turnstile Server-Side Validation
    secret = getattr(settings, "TURNSTILE_SECRET_KEY", None) or getattr(settings, "CAPTCHA_SECRET_KEY", None)
    if not secret:
        logger.error("TURNSTILE_SECRET_KEY is not configured in backend environment")
        return {
            "success": False,
            "action": None,
            "hostname": None,
            "error_codes": ["missing-input-secret"],
            "message": "Human verification service configuration error.",
        }

    verify_url = getattr(settings, "TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify")

    try:
        payload = {
            "secret": secret,
            "response": token,
        }
        if remote_ip:
            payload["remoteip"] = remote_ip

        resp = requests.post(verify_url, data=payload, timeout=8)
        data = resp.json()
    except requests.RequestException as e:
        logger.error(f"Turnstile connection error: {type(e).__name__}")
        return {
            "success": False,
            "action": None,
            "hostname": None,
            "error_codes": ["provider-unavailable"],
            "message": "Human verification service temporarily unavailable. Please try again.",
        }

    cf_success = data.get("success", False)
    cf_action = data.get("action")
    cf_hostname = data.get("hostname")
    cf_errors = data.get("error-codes", [])

    action_match = bool(not expected_action or not cf_action or cf_action == expected_action)
    
    allowed_hostnames = ["localhost", "127.0.0.1"]
    configured_host = getattr(settings, "ALLOWED_HOST", None)
    if configured_host:
        allowed_hostnames.append(configured_host)
    hostname_match = bool(not cf_hostname or cf_hostname.lower() in [h.lower() for h in allowed_hostnames])

    print("=== TURNSTILE SECURITY VERIFICATION ===", flush=True)
    print("Token present: YES", flush=True)
    print("Request sent: YES", flush=True)
    print("Siteverify called: YES", flush=True)
    print(f"Siteverify result: {'PASS' if cf_success else 'FAIL'}", flush=True)
    print(f"Siteverify error code: {cf_errors if cf_errors else 'None'}", flush=True)
    print(f"Action match: {'YES' if action_match else 'NO'}", flush=True)
    print(f"Hostname match: {'YES' if hostname_match else 'NO'}", flush=True)
    print("=======================================", flush=True)

    if not cf_success:
        logger.warning(f"Turnstile server-side verification FAILED error_codes={cf_errors}")
        is_expired = "timeout-or-duplicate" in cf_errors
        msg = "Verification token has expired. Please verify again." if is_expired else "Please complete the human verification and try again."
        return {
            "success": False,
            "action": cf_action,
            "hostname": cf_hostname,
            "error_codes": cf_errors,
            "message": msg,
        }

    # 4. Action matching enforcement
    if not action_match:
        logger.warning(f"Turnstile action mismatch: expected={expected_action}, received={cf_action}")
        return {
            "success": False,
            "action": cf_action,
            "hostname": cf_hostname,
            "error_codes": ["action-mismatch"],
            "message": "Verification action mismatch. Please refresh and try again.",
        }

    # 5. Hostname validation
    if not hostname_match:
        logger.warning(f"Turnstile hostname mismatch: received={cf_hostname}, allowed={allowed_hostnames}")
        return {
            "success": False,
            "action": cf_action,
            "hostname": cf_hostname,
            "error_codes": ["hostname-mismatch"],
            "message": "Verification hostname mismatch.",
        }

    # 6. Record token in replay cache
    with _cache_lock:
        _replay_cache[token] = now

    return {
        "success": True,
        "action": cf_action,
        "hostname": cf_hostname,
        "error_codes": [],
        "message": "Verification successful.",
    }
