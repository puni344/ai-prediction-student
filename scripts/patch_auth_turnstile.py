with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    code = f.read()

target = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action=expected_action, remote_ip=client_ip)
    if not turnstile_res["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "TURNSTILE_INVALID",
                "message": turnstile_res.get("message") or "Please complete the human verification and try again.",
            },
        )"""

replacement = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action=expected_action, remote_ip=client_ip)
    if not turnstile_res["success"]:
        if turnstile_res.get("error_codes") == ["action-mismatch"] and turnstile_res.get("action") in ("student_signup", "faculty_signup", "signup"):
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "TURNSTILE_INVALID",
                    "message": turnstile_res.get("message") or "Please complete the human verification and try again.",
                },
            )"""

if target in code:
    code = code.replace(target, replacement)
    with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
        f.write(code)
    print("backend/routers/auth.py signup turnstile tolerance patched successfully!")
else:
    print("Target not found in backend/routers/auth.py")
