"""Centralized Academic Programs Catalogue.

Defines standardized academic programs and their default durations in years.
"""
from typing import List, Dict, Any, Optional
import re

PROGRAMS: List[Dict[str, Any]] = [
    {"id": "btech", "name": "B.Tech", "full_name": "Bachelor of Technology", "duration_years": 4},
    {"id": "be", "name": "B.E.", "full_name": "Bachelor of Engineering", "duration_years": 4},
    {"id": "barch", "name": "B.Arch", "full_name": "Bachelor of Architecture", "duration_years": 5},
    {"id": "bca", "name": "BCA", "full_name": "Bachelor of Computer Applications", "duration_years": 3},
    {"id": "bsc", "name": "B.Sc.", "full_name": "Bachelor of Science", "duration_years": 3},
    {"id": "ba", "name": "B.A.", "full_name": "Bachelor of Arts", "duration_years": 3},
    {"id": "bcom", "name": "B.Com", "full_name": "Bachelor of Commerce", "duration_years": 3},
    {"id": "mtech", "name": "M.Tech", "full_name": "Master of Technology", "duration_years": 2},
    {"id": "me", "name": "M.E.", "full_name": "Master of Engineering", "duration_years": 2},
    {"id": "march", "name": "M.Arch", "full_name": "Master of Architecture", "duration_years": 2},
    {"id": "mca", "name": "MCA", "full_name": "Master of Computer Applications", "duration_years": 2},
    {"id": "mba", "name": "MBA", "full_name": "Master of Business Administration", "duration_years": 2},
    {"id": "msc", "name": "M.Sc.", "full_name": "Master of Science", "duration_years": 2},
    {"id": "ma", "name": "M.A.", "full_name": "Master of Arts", "duration_years": 2},
    {"id": "mcom", "name": "M.Com", "full_name": "Master of Commerce", "duration_years": 2},
    {"id": "diploma", "name": "Diploma", "full_name": "Diploma Engineering / Polytechnic", "duration_years": 3},
    {"id": "phd", "name": "Ph.D.", "full_name": "Doctor of Philosophy", "duration_years": 5},
    {"id": "other", "name": "Other", "full_name": "Other Academic Program", "duration_years": 4},
]


def get_program_by_name_or_id(val: Optional[str]) -> Optional[Dict[str, Any]]:
    if not val:
        return None
    val_clean = val.strip().lower()
    for p in PROGRAMS:
        if (
            p["name"].lower() == val_clean
            or p["id"].lower() == val_clean
            or p["full_name"].lower() == val_clean
        ):
            return p
    return None


def get_program_duration(program_name: Optional[str]) -> int:
    p = get_program_by_name_or_id(program_name)
    return p["duration_years"] if p else 4


def get_year_ordinal(year_num: int) -> str:
    if year_num == 1:
        return "1st Year"
    if year_num == 2:
        return "2nd Year"
    if year_num == 3:
        return "3rd Year"
    return f"{year_num}th Year"


def get_year_options_for_program(program_name: Optional[str]) -> List[str]:
    duration = get_program_duration(program_name)
    return [get_year_ordinal(i) for i in range(1, duration + 1)]


def get_year_number(year_str: Optional[str]) -> Optional[int]:
    if not year_str:
        return None
    m = re.search(r"(\d+)", year_str)
    return int(m.group(1)) if m else None


def validate_year_for_program(program_name: Optional[str], year_str: Optional[str]) -> bool:
    if not program_name or not year_str:
        return False
    p = get_program_by_name_or_id(program_name)
    if not p:
        return False
    yr = get_year_number(year_str)
    if yr is None:
        return False
    return 1 <= yr <= p["duration_years"]
