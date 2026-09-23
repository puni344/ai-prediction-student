"""Authentication request and response schemas."""
from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password with minimum 8 characters")
    full_name: str = Field(..., min_length=2)
    role: Literal["student", "faculty"] = Field(default="student")
    roll_number: Optional[str] = None
    faculty_id: Optional[str] = None
    program: Optional[str] = None
    department: Optional[str] = None
    departments: Optional[List[str]] = None
    academic_year: Optional[str] = None
    captcha_token: Optional[str] = None
    turnstile_token: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    captcha_token: Optional[str] = None
    turnstile_token: Optional[str] = None
    expected_role: Optional[str] = None


class EmailVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class ResendVerificationRequest(BaseModel):
    email: EmailStr
    captcha_token: Optional[str] = None
    turnstile_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    captcha_token: Optional[str] = None
    turnstile_token: Optional[str] = None


class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit reset code")


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str = Field(..., description="Short-lived reset authorization token")
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google Identity Services ID token")


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    is_email_verified: bool
    auth_provider: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    is_email_verified: bool = True
    auth_provider: str = "password"
    profile_complete: bool = True
    requires_profile_completion: bool = False
    user: Optional[UserResponse] = None


class GenericMessageResponse(BaseModel):
    status: str
    message: str
    detail: Optional[str] = None
    remaining_seconds: Optional[int] = None


class ForgotPasswordResponse(BaseModel):
    success: bool
    next_step: str
    message: str


class CompleteGoogleProfileRequest(BaseModel):
    roll_number: str = Field(..., min_length=2, max_length=50, description="Compulsory unique student roll number")
    program: str = Field(..., min_length=2, description="Academic program")
    department: str = Field(..., min_length=2, description="Academic department")
    academic_year: str = Field(..., min_length=2, description="Current academic year")
