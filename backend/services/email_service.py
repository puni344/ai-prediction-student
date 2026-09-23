"""Transactional Email Service for AI Student Performance.

Supports Gmail SMTP provider, Brevo API provider,
and development mock provider.
"""

import os
import ssl
import socket
import smtplib
import logging
import httpx
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

from backend.config import settings

logger = logging.getLogger(__name__)


def mask_email(email: str) -> str:
    """Mask an email address for safe logging without exposing PII."""
    if not email or "@" not in email:
        return "***"

    user, domain = email.split("@", 1)

    if len(user) <= 2:
        masked_user = user[0] + "*"
    else:
        masked_user = user[0] + "*" * (len(user) - 2) + user[-1]

    return f"{masked_user}@{domain}"


def log_smtp_diagnostics() -> None:
    """Log safe startup diagnostics without exposing credentials."""
    has_pass = bool(
        settings.SMTP_PASSWORD
        and len(settings.SMTP_PASSWORD.strip()) > 0
    )
    has_user = bool(
        settings.SMTP_USERNAME
        and len(settings.SMTP_USERNAME.strip()) > 0
    )

    logger.info(
        f"EMAIL_DIAGNOSTICS: provider={settings.EMAIL_PROVIDER} "
        f"host={settings.SMTP_HOST}:{settings.SMTP_PORT} "
        f"tls={settings.SMTP_USE_TLS} "
        f"username_configured={has_user} "
        f"password_configured={has_pass}"
    )


class EmailService(ABC):
    """Abstract base class for email delivery."""

    @abstractmethod
    def send_verification_email(
        self,
        to_email: str,
        full_name: str,
        otp: str,
    ) -> bool:
        pass

    @abstractmethod
    def send_password_reset_email(
        self,
        to_email: str,
        full_name: str,
        otp: str,
    ) -> bool:
        pass

    @abstractmethod
    def verify_connection(self) -> Dict[str, Any]:
        pass


class GmailSMTPProvider(EmailService):
    """Production Gmail SMTP email provider with STARTTLS."""

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME

        raw_pass = settings.SMTP_PASSWORD
        self.password = (
            raw_pass.strip().replace(" ", "")
            if raw_pass
            else None
        )

        self.use_tls = settings.SMTP_USE_TLS
        self.from_name = settings.EMAIL_FROM_NAME
        self.from_address = settings.EMAIL_FROM_ADDRESS

        log_smtp_diagnostics()

    def _create_html_template(
        self,
        title: str,
        greeting: str,
        message: str,
        otp: str,
        expiry_minutes: int,
        security_note: str,
    ) -> str:
        formatted_otp = " ".join(otp) if otp else ""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }}

    .wrapper {{
      width: 100%;
      background: linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%);
      padding: 40px 16px;
    }}

    .card {{
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.1);
    }}

    .header {{
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 50%, #8b5cf6 100%);
      padding: 36px 32px 32px 32px;
      text-align: center;
    }}

    .brand {{
      display: inline-block;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.15);
      padding: 6px 16px;
      border-radius: 9999px;
      backdrop-filter: blur(10px);
    }}

    .header-sub {{
      color: rgba(255, 255, 255, 0.9);
      font-size: 13px;
      margin-top: 10px;
      letter-spacing: 0.5px;
    }}

    .content {{
      padding: 36px 32px;
      background-color: #ffffff;
    }}

    h1 {{
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }}

    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 20px 0;
    }}

    .otp-container {{
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
      border: 2px dashed #cbd5e1;
      border-radius: 16px;
      padding: 26px 16px;
      text-align: center;
      margin: 28px 0;
    }}

    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 40px;
      font-weight: 900;
      letter-spacing: 12px;
      color: #4f46e5;
      margin: 8px 0;
      text-indent: 12px;
    }}

    .otp-label {{
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      font-weight: 700;
    }}

    .expiry-badge {{
      display: inline-block;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
      padding: 5px 14px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }}

    .security-box {{
      background-color: #f8fafc;
      border-left: 4px solid #6366f1;
      padding: 14px 18px;
      border-radius: 0 10px 10px 0;
      margin: 24px 0 0 0;
    }}

    .security-box p {{
      margin: 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }}

    .footer {{
      padding: 24px 32px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }}

    .footer p {{
      font-size: 12px;
      color: #94a3b8;
      margin: 0;
      line-height: 1.5;
    }}
  </style>
</head>

<body>
  <div class="wrapper">
    <div class="card">

      <div class="header">
        <div class="brand">AI Student Performance</div>
        <div class="header-sub">
          Academic Intelligence & Personalized Learning
        </div>
      </div>

      <div class="content">
        <h1>{title}</h1>

        <p>Hello <strong>{greeting}</strong>,</p>

        <p>{message}</p>

        <div class="otp-container">
          <div class="expiry-badge">
            ⏱️ Valid for {expiry_minutes} minutes
          </div>

          <div class="otp-code">{formatted_otp}</div>

          <div class="otp-label">
            Single-Use Security Code
          </div>
        </div>

        <div class="security-box">
          <p>
            <strong>Security Notice:</strong>
            {security_note}
          </p>
        </div>
      </div>

      <div class="footer">
        <p>
          AI Student Performance • Institutional Academic Intelligence Console
        </p>

        <p style="margin-top: 4px;">
          Automated system notification. Please do not reply directly to this email.
        </p>
      </div>

    </div>
  </div>
</body>
</html>"""

    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        email_type: str = "verification",
    ) -> bool:

        masked_dest = mask_email(to_email)

        logger.info(
            f"EMAIL_SEND_ATTEMPT type={email_type} "
            f"recipient={masked_dest}"
        )

        if not self.password or not self.username:
            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=configuration "
                f"diagnostic=SMTP credentials missing in environment"
            )
            return False

        current_stage = "connecting"

        try:
            with smtplib.SMTP(
                self.host,
                self.port,
                timeout=15,
            ) as server:

                if self.use_tls:
                    current_stage = "starttls"
                    server.starttls()

                current_stage = "authenticating"
                server.login(
                    self.username,
                    self.password,
                )

                current_stage = "sending"

                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = (
                    f"{self.from_name} <{self.from_address}>"
                )
                msg["To"] = to_email

                part = MIMEText(
                    html_body,
                    "html",
                    "utf-8",
                )

                msg.attach(part)

                server.sendmail(
                    self.from_address,
                    [to_email],
                    msg.as_string(),
                )

            current_stage = "completed"

            logger.info(
                f"EMAIL_SEND_SUCCESS type={email_type} "
                f"recipient={masked_dest}"
            )

            return True

        except smtplib.SMTPAuthenticationError as e:
            sanitized = (
                f"SMTP authentication failed ({e.smtp_code})"
            )

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except smtplib.SMTPDataError as e:
            msg_str = str(e).lower()

            if (
                e.smtp_code == 550
                or "sending limit" in msg_str
                or "daily user" in msg_str
            ):
                sanitized = (
                    f"SMTP sending limit exceeded ({e.smtp_code})"
                )
            else:
                sanitized = (
                    f"SMTP data error ({e.smtp_code})"
                )

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except (
            smtplib.SMTPConnectError,
            ConnectionRefusedError,
        ):
            sanitized = "Connection refused"

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except ssl.SSLError:
            sanitized = "TLS negotiation failed"

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except smtplib.SMTPRecipientsRefused:
            sanitized = "Recipient rejected"

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except smtplib.SMTPSenderRefused:
            sanitized = "Sender rejected"

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except smtplib.SMTPServerDisconnected:
            sanitized = "SMTP server disconnected prematurely"

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except (socket.timeout, TimeoutError):
            sanitized = "SMTP connection timed out"

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

        except Exception as e:
            sanitized = (
                f"SMTP delivery failed ({type(e).__name__})"
            )

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage={current_stage} "
                f"diagnostic={sanitized}"
            )

            return False

    def send_verification_email(
        self,
        to_email: str,
        full_name: str,
        otp: str,
    ) -> bool:

        subject = (
            "Verify your AI Student Performance account"
        )

        html = self._create_html_template(
            title="Verify your email address",
            greeting=full_name or "Student",
            message=(
                "Please verify your institutional email address "
                "to activate your account and access your "
                "personalized academic intelligence console."
            ),
            otp=otp,
            expiry_minutes=5,
            security_note=(
                "Never share this 6-digit code with anyone. "
                "If you did not create an account on "
                "AI Student Performance, you can safely "
                "disregard this email."
            ),
        )

        return self._send_email(
            to_email,
            subject,
            html,
            email_type="verification",
        )

    def send_password_reset_email(
        self,
        to_email: str,
        full_name: str,
        otp: str,
    ) -> bool:

        subject = (
            "Reset your AI Student Performance password"
        )

        html = self._create_html_template(
            title="Reset your account password",
            greeting=full_name or "User",
            message=(
                "We received a request to reset the password "
                "for your AI Student Performance account. "
                "Use the 6-digit code below to authorize "
                "your password update."
            ),
            otp=otp,
            expiry_minutes=5,
            security_note=(
                "If you did not request a password reset, "
                "your account is secure and you can safely "
                "disregard this email. No changes have been made."
            ),
        )

        return self._send_email(
            to_email,
            subject,
            html,
            email_type="password_reset",
        )

    def verify_connection(self) -> Dict[str, Any]:
        """Test SMTP server connectivity without sending an email."""

        configured = bool(
            self.password and self.username
        )

        if not configured:
            return {
                "provider": "gmail_smtp",
                "configured": False,
                "status": "NOT_CONFIGURED",
                "message": (
                    "SMTP credentials missing in environment"
                ),
            }

        try:
            with smtplib.SMTP(
                self.host,
                self.port,
                timeout=10,
            ) as server:

                if self.use_tls:
                    server.starttls()

                code, resp = server.login(
                    self.username,
                    self.password,
                )

            return {
                "provider": "gmail_smtp",
                "configured": True,
                "status": "CONNECTED",
                "auth_code": code,
                "message": (
                    f"Gmail SMTP connection verified successfully "
                    f"({code})"
                ),
            }

        except smtplib.SMTPAuthenticationError as e:
            return {
                "provider": "gmail_smtp",
                "configured": True,
                "status": "AUTH_FAILED",
                "error_code": e.smtp_code,
                "message": (
                    f"SMTP authentication failed ({e.smtp_code})"
                ),
            }

        except Exception as e:
            return {
                "provider": "gmail_smtp",
                "configured": True,
                "status": "ERROR",
                "message": (
                    f"SMTP connection failed: {type(e).__name__}"
                ),
            }


class BrevoAPIProvider(GmailSMTPProvider):
    """Production Brevo transactional email provider using HTTPS API."""

    BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"
    BREVO_ACCOUNT_URL = "https://api.brevo.com/v3/account"

    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.from_name = settings.EMAIL_FROM_NAME
        self.from_address = settings.EMAIL_FROM_ADDRESS

    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        email_type: str = "verification",
    ) -> bool:

        masked_dest = mask_email(to_email)

        logger.info(
            f"EMAIL_SEND_ATTEMPT type={email_type} "
            f"recipient={masked_dest} provider=brevo"
        )

        if not self.api_key:
            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=configuration "
                f"diagnostic=Brevo API key missing in environment"
            )
            return False

        if not self.from_address:
            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=configuration "
                f"diagnostic=Brevo sender email missing in environment"
            )
            return False

        payload = {
            "sender": {
                "name": self.from_name,
                "email": self.from_address,
            },
            "to": [
                {
                    "email": to_email,
                }
            ],
            "subject": subject,
            "htmlContent": html_body,
        }

        headers = {
            "accept": "application/json",
            "api-key": self.api_key,
            "content-type": "application/json",
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(
                    self.BREVO_SEND_URL,
                    headers=headers,
                    json=payload,
                )

            if response.status_code in (200, 201):
                logger.info(
                    f"EMAIL_SEND_SUCCESS type={email_type} "
                    f"recipient={masked_dest} provider=brevo"
                )
                return True

            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=api "
                f"diagnostic=Brevo API returned HTTP "
                f"{response.status_code}"
            )

            return False

        except httpx.TimeoutException:
            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=connecting "
                f"diagnostic=Brevo API request timed out"
            )
            return False

        except httpx.HTTPError as e:
            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=connecting "
                f"diagnostic=Brevo HTTP error "
                f"({type(e).__name__})"
            )
            return False

        except Exception as e:
            logger.error(
                f"EMAIL_SEND_FAILURE type={email_type} "
                f"recipient={masked_dest} "
                f"stage=api "
                f"diagnostic=Brevo delivery failed "
                f"({type(e).__name__})"
            )
            return False

    def verify_connection(self) -> Dict[str, Any]:
        """Verify Brevo API credentials without sending an email."""

        if not self.api_key:
            return {
                "provider": "brevo",
                "configured": False,
                "status": "NOT_CONFIGURED",
                "message": (
                    "Brevo API key missing in environment"
                ),
            }

        headers = {
            "accept": "application/json",
            "api-key": self.api_key,
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(
                    self.BREVO_ACCOUNT_URL,
                    headers=headers,
                )

            if response.status_code == 200:
                return {
                    "provider": "brevo",
                    "configured": True,
                    "status": "CONNECTED",
                    "message": (
                        "Brevo API connection verified successfully"
                    ),
                }

            return {
                "provider": "brevo",
                "configured": True,
                "status": "ERROR",
                "message": (
                    f"Brevo API returned HTTP "
                    f"{response.status_code}"
                ),
            }

        except Exception as e:
            return {
                "provider": "brevo",
                "configured": True,
                "status": "ERROR",
                "message": (
                    f"Brevo API connection failed: "
                    f"{type(e).__name__}"
                ),
            }


class DevelopmentEmailProvider(EmailService):
    """Development/testing email provider that records messages in memory without external calls."""

    def __init__(self):
        self.sent_emails = []

    def send_verification_email(
        self,
        to_email: str,
        full_name: str,
        otp: str,
    ) -> bool:

        masked_dest = mask_email(to_email)

        logger.info(
            f"[MOCK EMAIL] Verification OTP dispatched to "
            f"{masked_dest} "
            f"(6-digit OTP generated, expires in 5 minutes)"
        )

        self.sent_emails.append(
            {
                "to": to_email,
                "type": "verification",
                "otp": otp,
                "created_at": datetime.now(timezone.utc),
            }
        )

        return True

    def send_password_reset_email(
        self,
        to_email: str,
        full_name: str,
        otp: str,
    ) -> bool:

        masked_dest = mask_email(to_email)

        logger.info(
            f"[MOCK EMAIL] Password reset OTP dispatched to "
            f"{masked_dest} "
            f"(6-digit OTP generated, expires in 5 minutes)"
        )

        self.sent_emails.append(
            {
                "to": to_email,
                "type": "password_reset",
                "otp": otp,
                "created_at": datetime.now(timezone.utc),
            }
        )

        return True

    def get_latest_otp(
        self,
        to_email: str,
    ) -> Optional[str]:

        for item in reversed(self.sent_emails):
            if item["to"].lower() == to_email.lower():
                return item["otp"]

        return None

    def verify_connection(self) -> Dict[str, Any]:
        return {
            "provider": "mock",
            "configured": True,
            "status": "MOCK_ACTIVE",
            "message": "Development mock provider active",
        }


_dev_provider_instance = DevelopmentEmailProvider()


def get_email_service() -> EmailService:
    """Factory creating configured EmailService.

    Supports:
    - EMAIL_PROVIDER=mock (development mock)
    - EMAIL_PROVIDER=brevo (Brevo HTTPS API)
    - EMAIL_PROVIDER=smtp (real Gmail SMTP)

    Never fall back silently to DevelopmentEmailProvider.
    """

    provider = getattr(
        settings,
        "EMAIL_PROVIDER",
        "smtp",
    ).lower().strip()

    app_env = getattr(
        settings,
        "APP_ENV",
        "development",
    ).lower().strip()

    if provider in ("mock", "development", "test"):
        if app_env == "production":
            raise RuntimeError(
                "Mock email provider is strictly prohibited "
                "in production environments."
            )

        return _dev_provider_instance

    if provider == "brevo":
        return BrevoAPIProvider()

    # Real SMTP provider: Do NOT fall back silently to mock.
    return GmailSMTPProvider()
