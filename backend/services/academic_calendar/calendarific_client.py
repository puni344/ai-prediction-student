"""Calendarific API v2 client for India & Andhra Pradesh (IN / in-ap).

External API: https://calendarific.com/api/v2
- GET /api/v2/holidays?api_key={key}&country=IN&year={year}&location=in-ap&type=national,local,religious,observance

Security & Design:
- Single API key used for all years (2025, 2026, 2027, etc.)
- Never logs API keys in logs, errors, or stack traces
- Handles HTTP 401, 403, 429 (monthly quota), 500, 503 gracefully
- Implements 10s timeout with exponential backoff retry
- Strict holiday classification:
    * National / Common local holiday -> PUBLIC_HOLIDAY (default_no_college = True)
    * Optional holiday -> OPTIONAL_HOLIDAY (default_no_college = False)
    * Religious / Festival -> FESTIVAL (default_no_college = False, informational only)
    * Observance / Season -> OBSERVANCE (default_no_college = False, informational only)
"""
import time
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union

import httpx

logger = logging.getLogger(__name__)


class CalendarificClient:
    """Client for Calendarific v2 Holidays API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://calendarific.com/api/v2",
        country: str = "IN",
        location: str = "in-ap",
        timeout: float = 10.0,
        max_retries: int = 2,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.country = country
        self.location = location
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def is_configured(self) -> bool:
        """Check if API key is provided."""
        return bool(self.api_key and self.api_key.strip())

    def _request(self, endpoint: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Execute request with retry and exponential backoff, shielding the API key."""
        if not self.is_configured:
            logger.info("Calendarific API key not configured. Using local/cached calendar data.")
            return None

        # Build query parameters with key
        req_params = dict(params)
        req_params["api_key"] = self.api_key
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.get(url, params=req_params)

                if response.status_code == 200:
                    data = response.json()
                    meta_code = data.get("meta", {}).get("code")
                    if meta_code == 200:
                        return data
                    logger.warning(
                        "calendarific_api_meta_error | endpoint=%s | year=%s | code=%s | error=%s",
                        endpoint,
                        params.get("year", "N/A"),
                        meta_code,
                        data.get("meta", {}).get("error_detail", "Unknown"),
                    )
                    return None

                logger.warning(
                    "calendarific_sync_failed | endpoint=%s | year=%s | status_code=%d | attempt=%d/%d",
                    endpoint,
                    params.get("year", "N/A"),
                    response.status_code,
                    attempt + 1,
                    self.max_retries + 1,
                )

                if response.status_code in (401, 403):
                    logger.error("Calendarific authentication failed. Please verify CALENDARIFIC_API_KEY configuration.")
                    return None

                if response.status_code == 429:
                    logger.warning("Calendarific monthly quota exceeded (HTTP 429). Using cached/local calendar.")
                    return None

            except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError) as exc:
                logger.warning(
                    "calendarific_request_error | endpoint=%s | year=%s | error=%s | attempt=%d/%d",
                    endpoint,
                    params.get("year", "N/A"),
                    type(exc).__name__,
                    attempt + 1,
                    self.max_retries + 1,
                )

            if attempt < self.max_retries:
                backoff = 2 ** attempt
                time.sleep(backoff)

        return None

    def get_holidays(
        self,
        year: int,
        location: Optional[str] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        """Fetch and normalize holidays for given year from Calendarific v2.

        Uses country=IN, location=in-ap, and types=national,local,religious,observance.
        """
        loc = (location or self.location).lower() if (location or self.location) else "in-ap"
        params = {
            "country": self.country,
            "year": str(year),
            "location": loc,
            "type": "national,local,religious,observance",
        }

        raw_data = self._request("holidays", params)
        if not raw_data:
            return None

        holidays_list = raw_data.get("response", {}).get("holidays", [])
        normalized = []

        for h in holidays_list:
            name = h.get("name", "").strip()
            if not name:
                continue

            description = h.get("description", "") or ""
            date_info = h.get("date", {})
            iso_date = date_info.get("iso", "")
            if not iso_date and isinstance(date_info, str):
                iso_date = date_info
            
            # Format to YYYY-MM-DD
            clean_date = iso_date[:10] if len(iso_date) >= 10 else ""
            if not clean_date:
                continue

            # Process types
            raw_types = h.get("type", [])
            if isinstance(raw_types, str):
                raw_types = [raw_types]
            types_lower = [t.lower() for t in raw_types]
            primary_type = (h.get("primary_type") or "").lower()

            # Classification rules:
            # 1. National or Local holiday -> PUBLIC_HOLIDAY (College closed by default)
            is_national = any("national" in t for t in types_lower) or "national" in primary_type
            is_local = any("local" in t for t in types_lower) or "local" in primary_type
            is_optional = any("optional" in t for t in types_lower) or "optional" in primary_type

            # Check for religious/festival/observance
            is_religious = any(
                r in t for t in types_lower for r in ("religious", "hinduism", "muslim", "christian", "sikh", "jain", "buddhist")
            )
            is_observance = any("observance" in t or "season" in t for t in types_lower)

            if is_national or is_local:
                category = "PUBLIC_HOLIDAY"
                is_public = True
                is_default_no_college = True
            elif is_optional:
                category = "OPTIONAL_HOLIDAY"
                is_public = False
                is_default_no_college = False
            elif is_religious or "festival" in name.lower():
                category = "FESTIVAL"
                is_public = False
                is_default_no_college = False  # Festival is informational only!
            elif is_observance:
                category = "OBSERVANCE"
                is_public = False
                is_default_no_college = False  # Observance is informational only!
            else:
                category = "OBSERVANCE"
                is_public = False
                is_default_no_college = False

            normalized.append({
                "name": name,
                "date": clean_date,
                "description": description,
                "category": category,
                "primary_type": primary_type or (raw_types[0] if raw_types else "holiday"),
                "raw_types": raw_types,
                "is_public_holiday": is_public,
                "is_default_no_college": is_default_no_college,
                "country": self.country,
                "location": loc,
                "locations_raw": h.get("locations", ""),
                "states": h.get("states", []),
            })

        return normalized
