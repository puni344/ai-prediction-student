"""Centralized academic department catalogue for student registration and faculty assignments."""
from typing import List, Dict, Optional

DEPARTMENTS: List[Dict[str, str]] = [
    {"id": "cse", "name": "Computer Science and Engineering"},
    {"id": "it", "name": "Information Technology"},
    {"id": "aiml", "name": "Artificial Intelligence and Machine Learning"},
    {"id": "aids", "name": "Artificial Intelligence and Data Science"},
    {"id": "ds", "name": "Data Science"},
    {"id": "ece", "name": "Electronics and Communication Engineering"},
    {"id": "eee", "name": "Electrical and Electronics Engineering"},
    {"id": "ee", "name": "Electrical Engineering"},
    {"id": "eie", "name": "Electronics and Instrumentation Engineering"},
    {"id": "me", "name": "Mechanical Engineering"},
    {"id": "ce", "name": "Civil Engineering"},
    {"id": "che", "name": "Chemical Engineering"},
    {"id": "bt", "name": "Biotechnology"},
    {"id": "bme", "name": "Biomedical Engineering"},
    {"id": "ae", "name": "Aerospace Engineering"},
    {"id": "au", "name": "Automobile Engineering"},
    {"id": "ie", "name": "Industrial Engineering"},
    {"id": "pe", "name": "Production Engineering"},
    {"id": "mte", "name": "Mechatronics Engineering"},
    {"id": "ra", "name": "Robotics and Automation"},
    {"id": "iot", "name": "Internet of Things"},
    {"id": "csbs", "name": "Computer Science and Business Systems"},
    {"id": "csd", "name": "Computer Science and Design"},
    {"id": "cys", "name": "Cyber Security"},
    {"id": "se", "name": "Software Engineering"},
    {"id": "ise", "name": "Information Science and Engineering"},
    {"id": "other", "name": "Other"},
]

# Quick lookup by ID or normalized name
DEPARTMENT_ID_MAP = {d["id"].lower(): d["name"] for d in DEPARTMENTS}
DEPARTMENT_NAME_MAP = {d["name"].lower(): d["name"] for d in DEPARTMENTS}


def validate_and_normalize_department(dept_input: Optional[str]) -> Optional[str]:
    """Validate department input against canonical catalogue and return official display name."""
    if not dept_input or not dept_input.strip():
        return None
    cleaned = dept_input.strip().lower()
    if cleaned in DEPARTMENT_ID_MAP:
        return DEPARTMENT_ID_MAP[cleaned]
    if cleaned in DEPARTMENT_NAME_MAP:
        return DEPARTMENT_NAME_MAP[cleaned]
    # Allow legacy or partial matches if recognizable
    for d in DEPARTMENTS:
        if d["name"].lower() == cleaned or d["id"].lower() == cleaned:
            return d["name"]
    return None
