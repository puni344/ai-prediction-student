"""Rate limiting and suspicious login detection service."""
import time
from abc import ABC, abstractmethod
from typing import Dict, Tuple


class RateLimiter(ABC):
    """Abstract base class defining rate limiter contract."""

    @abstractmethod
    def record_login_failure(self, identifier: str) -> None:
        pass

    @abstractmethod
    def is_captcha_required_for_login(self, identifier: str) -> bool:
        pass

    @abstractmethod
    def reset_login_failures(self, identifier: str) -> None:
        pass

    @abstractmethod
    def check_resend_cooldown(self, user_id: int, cooldown_seconds: int = 60) -> Tuple[bool, int]:
        pass

    @abstractmethod
    def check_ip_rate_limit(self, ip: str, action: str, limit: int = 20, window_seconds: int = 60) -> bool:
        pass

    @abstractmethod
    def is_captcha_required_for_resend(self, user_id: int, threshold: int = 2) -> bool:
        pass

    @abstractmethod
    def record_resend_attempt(self, user_id: int) -> None:
        pass


class InMemoryRateLimiter(RateLimiter):
    """Local, in-memory implementation of rate limiting."""

    def __init__(self):
        self._login_failures: Dict[str, Tuple[int, float]] = {}
        self._resend_cooldowns: Dict[int, float] = {}
        self._resend_counts: Dict[int, int] = {}
        self._ip_windows: Dict[str, list[float]] = {}

    def record_login_failure(self, identifier: str) -> None:
        now = time.time()
        count, _ = self._login_failures.get(identifier, (0, now))
        self._login_failures[identifier] = (count + 1, now)

    def is_captcha_required_for_login(self, identifier: str) -> bool:
        count, timestamp = self._login_failures.get(identifier, (0, 0))
        # Lockout / CAPTCHA threshold: 3 failed attempts within 15 minutes
        if count >= 3 and (time.time() - timestamp) < 900:
            return True
        return False

    def reset_login_failures(self, identifier: str) -> None:
        self._login_failures.pop(identifier, None)

    def check_resend_cooldown(self, user_id: int, cooldown_seconds: int = 60) -> Tuple[bool, int]:
        now = time.time()
        last_time = self._resend_cooldowns.get(user_id, 0)
        elapsed = now - last_time
        if elapsed < cooldown_seconds:
            return False, int(cooldown_seconds - elapsed)
        self._resend_cooldowns[user_id] = now
        return True, 0

    def check_ip_rate_limit(self, ip: str, action: str, limit: int = 20, window_seconds: int = 60) -> bool:
        key = f"{ip}:{action}"
        now = time.time()
        timestamps = self._ip_windows.get(key, [])
        # Filter timestamps within window
        valid = [t for t in timestamps if now - t < window_seconds]
        if len(valid) >= limit:
            return False
        valid.append(now)
        self._ip_windows[key] = valid
        return True

    def is_captcha_required_for_resend(self, user_id: int, threshold: int = 2) -> bool:
        """Determine if CAPTCHA is required for OTP resend (after excessive attempts)."""
        return self._resend_counts.get(user_id, 0) >= threshold

    def record_resend_attempt(self, user_id: int) -> None:
        """Record an OTP resend attempt for abuse tracking."""
        self._resend_counts[user_id] = self._resend_counts.get(user_id, 0) + 1


class NoopRateLimiter(RateLimiter):
    """No-op rate limiter used for testing or disabled rate limiting."""

    def record_login_failure(self, identifier: str) -> None:
        pass

    def is_captcha_required_for_login(self, identifier: str) -> bool:
        return False

    def reset_login_failures(self, identifier: str) -> None:
        pass

    def check_resend_cooldown(self, user_id: int, cooldown_seconds: int = 60) -> Tuple[bool, int]:
        return True, 0

    def check_ip_rate_limit(self, ip: str, action: str, limit: int = 20, window_seconds: int = 60) -> bool:
        return True

    def is_captcha_required_for_resend(self, user_id: int, threshold: int = 2) -> bool:
        return False

    def record_resend_attempt(self, user_id: int) -> None:
        pass


# Global default instance
_default_rate_limiter = InMemoryRateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Factory returning the active rate limiter implementation."""
    return _default_rate_limiter
