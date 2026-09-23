with open("backend/schemas/auth.py", "r", encoding="utf-8") as f:
    c = f.read()

old_block = """class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    is_email_verified: bool = True
    auth_provider: str = "password"
    profile_complete: bool = True
    requires_profile_completion: bool = False


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    is_email_verified: bool
    auth_provider: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)"""

new_block = """class UserResponse(BaseModel):
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
    user: Optional[UserResponse] = None"""

if old_block in c:
    c = c.replace(old_block, new_block)
    with open("backend/schemas/auth.py", "w", encoding="utf-8") as f:
        f.write(c)
    print("backend/schemas/auth.py updated successfully.")
else:
    print("old_block not found in backend/schemas/auth.py")

# Also update verify_email and login in backend/routers/auth.py to populate user=user
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    rc = f.read()

old_verify_ret = """    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        is_email_verified=True,
        auth_provider=user.auth_provider or "password",
        profile_complete=not requires_profile_completion,
        requires_profile_completion=requires_profile_completion,
    )"""

new_verify_ret = """    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        is_email_verified=True,
        auth_provider=user.auth_provider or "password",
        profile_complete=not requires_profile_completion,
        requires_profile_completion=requires_profile_completion,
        user=UserResponse.model_validate(user),
    )"""

old_login_ret = """    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        is_email_verified=user.is_email_verified,
        auth_provider=user.auth_provider or "password",
        profile_complete=not requires_profile_completion,
        requires_profile_completion=requires_profile_completion,
    )"""

new_login_ret = """    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        is_email_verified=user.is_email_verified,
        auth_provider=user.auth_provider or "password",
        profile_complete=not requires_profile_completion,
        requires_profile_completion=requires_profile_completion,
        user=UserResponse.model_validate(user),
    )"""

rc = rc.replace(old_verify_ret, new_verify_ret)
rc = rc.replace(old_login_ret, new_login_ret)

with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
    f.write(rc)
print("backend/routers/auth.py updated successfully.")
