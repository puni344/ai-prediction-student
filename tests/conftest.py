import pytest
from backend.services.rate_limiter import get_rate_limiter

@pytest.fixture(autouse=True)
def auto_clear_rate_limits():
    """Clear rate limiting windows between tests to prevent 429 rate limit test pollution."""
    rl = get_rate_limiter()
    for attr in ("_ip_windows", "_login_failures", "_requests", "_windows"):
        if hasattr(rl, attr):
            getattr(rl, attr).clear()
    yield
    for attr in ("_ip_windows", "_login_failures", "_requests", "_windows"):
        if hasattr(rl, attr):
            getattr(rl, attr).clear()
