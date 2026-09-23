"""Email validation policy for institutional registration."""
import re
from typing import Tuple

# Switch to True in future to enforce *.edu.in institutional email addresses
ENFORCE_COLLEGE_DOMAIN = False
ALLOWED_DOMAINS = [".edu.in"]


def validate_email_policy(email: str) -> Tuple[bool, str]:
    """Validate email format and institutional domain requirements."""
    if not email or not email.strip():
        return False, "Email address is required."
    
    clean_email = email.strip().lower()
    
    # Standard email regex
    email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(email_regex, clean_email):
        return False, "Please enter a valid email address."
    
    if ENFORCE_COLLEGE_DOMAIN:
        if not any(clean_email.endswith(dom) for dom in ALLOWED_DOMAINS):
            return False, "Registration requires an institutional email ending with .edu.in"
            
    return True, "Email address is valid."
