"""Google Identity Services server-side token verification service."""
import logging
from typing import Dict, Any
from fastapi import HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from backend.config import settings

logger = logging.getLogger(__name__)


def verify_google_token(id_token_str: str) -> Dict[str, Any]:
    """Verify Google ID token server-side adhering strictly to all security requirements.
    
    Validates:
    - signature (verified by Google crypto public keys)
    - iss (accounts.google.com or https://accounts.google.com)
    - aud (matches settings.GOOGLE_CLIENT_ID if configured)
    - exp (verified not expired)
    - sub (present and non-empty)
    - email (present)
    - email_verified == true
    """
    if not id_token_str or not id_token_str.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_GOOGLE_TOKEN: Token cannot be empty.",
        )

    clean_token = id_token_str.strip()

    # Reject placeholder/mock tokens
    if "mock_" in clean_token or clean_token.count(".") != 2:
        logger.warning("Rejected invalid/mock Google ID token structure.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_GOOGLE_TOKEN: Mock or malformed tokens are strictly prohibited. A real Google credential is required.",
        )

    try:
        req = google_requests.Request()
        audience = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
        idinfo = id_token.verify_oauth2_token(clean_token, req, audience=audience)

        # 1. Verify issuer
        iss = idinfo.get("iss")
        if iss not in ["accounts.google.com", "https://accounts.google.com"]:
            logger.warning(f"Google token rejected due to invalid issuer: {iss}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_GOOGLE_TOKEN: Invalid token issuer.",
            )

        # 2. Verify sub
        sub = idinfo.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_GOOGLE_TOKEN: Missing subject identifier.",
            )

        # 3. Verify email
        email = idinfo.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_GOOGLE_TOKEN: Missing email claim.",
            )

        # 4. Verify email_verified == True
        if idinfo.get("email_verified") is not True:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GOOGLE_EMAIL_NOT_VERIFIED: Your Google account email is not verified.",
            )

        return idinfo
    except ValueError as e:
        logger.warning(f"Google token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"INVALID_GOOGLE_TOKEN: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during Google token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication failed due to an internal server error.",
        )
