"""Holiday API client for IN-AP (Andhra Pradesh, India).

External API: https://holidayapi.com/v1
- GET /v1/holidays?country=IN-AP&year={year}&public=true&subdivisions=true
- GET /v1/countries?key={key}

Implements:
- Timeout: 10 seconds
- Retry: 2 attempts with exponential backoff
- Never logs API keys
- Logs sync failures with year, status_code, error, timestamp
"""
import time
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import httpx

logger = logging.getLogger(__name__)


class HolidayAPIClient:
    """Client for Holiday API (holidayapi.com)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://holidayapi.com/v1",
        country: str = "IN-AP",
        timeout: float = 10.0,
        max_retries: int = 2,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.country = country
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def is_configured(self) -> bool:
        """Check if API key is available."""
        return bool(self.api_key)

    def _request(self, endpoint: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make a request with retry and exponential backoff."""
        if not self.is_configured:
            logger.warning("Holiday API key not configured. Skipping API call.")
            return None

        params["key"] = self.api_key
        url = f"{self.base_url}/{endpoint}"

        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.get(url, params=params)

                if response.status_code == 200:
                    return response.json()

                logger.error(
                    "holiday_sync_failed | endpoint=%s | year=%s | status_code=%d | attempt=%d/%d | timestamp=%s",
                    endpoint,
                    params.get("year", "N/A"),
                    response.status_code,
                    attempt + 1,
                    self.max_retries + 1,
                    datetime.now(timezone.utc).isoformat(),
                )

                if response.status_code in (401, 403):
                    logger.error("Holiday API authentication failed. Check API key configuration.")
                    return None

            except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError) as exc:
                logger.error(
                    "holiday_sync_failed | endpoint=%s | year=%s | error=%s | attempt=%d/%d | timestamp=%s",
                    endpoint,
                    params.get("year", "N/A"),
                    type(exc).__name__,
                    attempt + 1,
                    self.max_retries + 1,
                    datetime.now(timezone.utc).isoformat(),
                )

            if attempt < self.max_retries:
                backoff = 2 ** attempt
                time.sleep(backoff)

        return None

    def get_countries(self) -> Optional[Dict[str, Any]]:
        """GET /v1/countries — diagnostics only."""
        return self._request("countries", {})

    def get_holidays(self, year: int) -> Optional[List[Dict[str, Any]]]:
        """GET /v1/holidays for IN-AP.

        Returns list of holiday dicts with: name, date, observed, public, country, uuid.
        Returns None on failure.
        """
        params = {
            "country": self.country,
            "year": str(year),
            "public": "true",
            "subdivisions": "true",
            "format": "json",
        }
        result = self._request("holidays", params)
        if result and "holidays" in result:
            holidays = result["holidays"]
            # Parse only needed fields
            parsed = []
            for h in holidays:
                parsed.append({
                    "name": h.get("name", "Unknown Holiday"),
                    "date": h.get("date", ""),
                    "observed": h.get("observed", h.get("date", "")),
                    "public": h.get("public", False),
                    "country": h.get("country", self.country),
                    "uuid": h.get("uuid", ""),
                })
            return parsed
        return None

    def get_public_holidays(self, year: int) -> Optional[List[Dict[str, Any]]]:
        """Get only public holidays for a year."""
        all_holidays = self.get_holidays(year)
        if all_holidays is None:
            return None
        return [h for h in all_holidays if h.get("public", False)]
