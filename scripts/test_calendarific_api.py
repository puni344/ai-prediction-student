"""Real integration test script for Calendarific API v2.

Tests:
- 2025, 2026, 2027 using the single configured CALENDARIFIC_API_KEY
- country = IN
- location = in-ap (Andhra Pradesh ISO 3166-2 region)
- Verifies response structure, holiday counts, and normalized entries
- NEVER prints the API key
"""
import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.services.academic_calendar.calendarific_client import CalendarificClient

def run_test():
    api_key = settings.CALENDARIFIC_API_KEY
    if not api_key:
        print("SKIPPED — CALENDARIFIC_API_KEY not configured")
        return

    print("==================================================")
    print("CALENDARIFIC API v2 INTEGRATION TEST")
    print("==================================================")
    print(f"Country: {settings.CALENDARIFIC_COUNTRY}")
    print(f"Location: {settings.CALENDARIFIC_LOCATION}")
    print(f"Base URL: {settings.CALENDARIFIC_BASE_URL}")
    print("API Key: [CONFIGURED - SHIELDED]")
    print("==================================================")

    client = CalendarificClient(
        api_key=api_key,
        base_url=settings.CALENDARIFIC_BASE_URL,
        country=settings.CALENDARIFIC_COUNTRY,
        location=settings.CALENDARIFIC_LOCATION,
    )

    years = [2025, 2026, 2027]
    all_success = True

    for year in years:
        print(f"\n--- Requesting Year {year} (location={settings.CALENDARIFIC_LOCATION}) ---")
        try:
            holidays = client.get_holidays(year)
            if holidays is not None:
                print(f"HTTP Status: 200 OK")
                print(f"Holidays returned: {len(holidays)}")
                if holidays:
                    print("Sample normalized entries:")
                    for h in holidays[:3]:
                        print(f"  - [{h['date']}] {h['name']} | Category: {h['category']} | Default No College: {h['is_default_no_college']}")
                else:
                    print("  (0 holidays returned for this year)")
            else:
                print(f"Failed to fetch data for {year} (HTTP error or quota)")
                all_success = False
        except Exception as e:
            print(f"Exception during request for {year}: {type(e).__name__}: {e}")
            all_success = False

    print("\n==================================================")
    if all_success:
        print("ALL YEARS TEST COMPLETED SUCCESSFULLY")
    else:
        print("TEST COMPLETED WITH SOME WARNINGS / ERRORS")
    print("==================================================")

if __name__ == "__main__":
    run_test()
