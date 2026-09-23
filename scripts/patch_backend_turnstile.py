with open("backend/services/turnstile_service.py", "r", encoding="utf-8") as f:
    ts = f.read()

# Update replay cache logging
old_replay_log = """        if token in _replay_cache:
            logger.warning("Turnstile validation failed: token replay detected")
            logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
            logger.info("Token received frontend: YES")
            logger.info("Token sent backend: YES")
            logger.info("Siteverify called: NO (REPLAY PREVENTED)")
            logger.info("Siteverify success: NO")
            logger.info("Action match: NO")
            logger.info("Hostname match: NO")
            logger.info("=======================================")
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["timeout-or-duplicate"],
                "message": "Verification token has already been used. Please verify again.",
            }"""

new_replay_log = """        if token in _replay_cache:
            logger.warning("Turnstile validation failed: token replay detected")
            print("=== TURNSTILE SECURITY VERIFICATION ===", flush=True)
            print("Token present: YES", flush=True)
            print("Request sent: YES", flush=True)
            print("Siteverify called: NO (REPLAY PREVENTED)", flush=True)
            print("Siteverify result: FAIL", flush=True)
            print("Siteverify error code: timeout-or-duplicate", flush=True)
            print("Action match: NO", flush=True)
            print("Hostname match: NO", flush=True)
            print("=======================================", flush=True)
            return {
                "success": False,
                "action": None,
                "hostname": None,
                "error_codes": ["timeout-or-duplicate"],
                "message": "Verification token has already been used. Please verify again.",
            }"""

if old_replay_log in ts:
    ts = ts.replace(old_replay_log, new_replay_log)
    print("Updated replay log in turnstile_service.py")

# Update real siteverify logging
old_siteverify_log = """    logger.info("=== TURNSTILE SECURITY VERIFICATION ===")
    logger.info("Token received frontend: YES")
    logger.info("Token sent backend: YES")
    logger.info("Siteverify called: YES")
    logger.info(f"Siteverify success: {'YES' if cf_success else 'NO'}")
    logger.info(f"Action match: {'YES' if action_match else 'NO'}")
    logger.info(f"Hostname match: {'YES' if hostname_match else 'NO'}")
    logger.info("=======================================")

    if not cf_success:
        logger.warning(f"Turnstile server-side verification FAILED error_codes={cf_errors}")
        return {
            "success": False,
            "action": cf_action,
            "hostname": cf_hostname,
            "error_codes": cf_errors,
            "message": "Please complete the human verification and try again.",
        }"""

new_siteverify_log = """    print("=== TURNSTILE SECURITY VERIFICATION ===", flush=True)
    print("Token present: YES", flush=True)
    print("Request sent: YES", flush=True)
    print("Siteverify called: YES", flush=True)
    print(f"Siteverify result: {'PASS' if cf_success else 'FAIL'}", flush=True)
    print(f"Siteverify error code: {cf_errors if cf_errors else 'None'}", flush=True)
    print(f"Action match: {'YES' if action_match else 'NO'}", flush=True)
    print(f"Hostname match: {'YES' if hostname_match else 'NO'}", flush=True)
    print("=======================================", flush=True)

    if not cf_success:
        logger.warning(f"Turnstile server-side verification FAILED error_codes={cf_errors}")
        is_expired = "timeout-or-duplicate" in cf_errors
        msg = "Verification token has expired. Please verify again." if is_expired else "Please complete the human verification and try again."
        return {
            "success": False,
            "action": cf_action,
            "hostname": cf_hostname,
            "error_codes": cf_errors,
            "message": msg,
        }"""

if old_siteverify_log in ts:
    ts = ts.replace(old_siteverify_log, new_siteverify_log)
    print("Updated siteverify log in turnstile_service.py")

with open("backend/services/turnstile_service.py", "w", encoding="utf-8") as f:
    f.write(ts)
print("Saved turnstile_service.py")

# Update backend/routers/auth.py
with open("backend/routers/auth.py", "r", encoding="utf-8") as f:
    auth_py = f.read()

# Signup turnstile error code
old_auth_turnstile = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action=expected_action, remote_ip=client_ip)
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

new_auth_turnstile = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action=expected_action, remote_ip=client_ip)
    if not turnstile_res["success"]:
        if turnstile_res.get("error_codes") == ["action-mismatch"] and turnstile_res.get("action") in ("student_signup", "faculty_signup", "signup"):
            pass
        else:
            err_code = "TURNSTILE_EXPIRED" if "timeout-or-duplicate" in turnstile_res.get("error_codes", []) else "TURNSTILE_INVALID"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": err_code,
                    "message": turnstile_res.get("message") or "Security verification failed. Please try again.",
                },
            )"""

if old_auth_turnstile in auth_py:
    auth_py = auth_py.replace(old_auth_turnstile, new_auth_turnstile)
    print("Updated signup turnstile check in backend/routers/auth.py")

# Login turnstile error code
old_login_turnstile = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action=expected_action, remote_ip=client_ip)
    if not turnstile_res["success"]:
        if turnstile_res.get("error_codes") == ["action-mismatch"] and turnstile_res.get("action") in ("student_login", "faculty_login", "admin_login"):
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "TURNSTILE_INVALID",
                    "message": turnstile_res.get("message") or "Please complete the human verification and try again.",
                },
            )"""

new_login_turnstile = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action=expected_action, remote_ip=client_ip)
    if not turnstile_res["success"]:
        if turnstile_res.get("error_codes") == ["action-mismatch"] and turnstile_res.get("action") in ("student_login", "faculty_login", "admin_login", "login"):
            pass
        else:
            err_code = "TURNSTILE_EXPIRED" if "timeout-or-duplicate" in turnstile_res.get("error_codes", []) else "TURNSTILE_INVALID"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": err_code,
                    "message": turnstile_res.get("message") or "Security verification failed. Please try again.",
                },
            )"""

if old_login_turnstile in auth_py:
    auth_py = auth_py.replace(old_login_turnstile, new_login_turnstile)
    print("Updated login turnstile check in backend/routers/auth.py")

# Forgot password turnstile error code
old_forgot_turnstile = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action="forgot_password", remote_ip=client_ip)
    if not turnstile_res["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "TURNSTILE_INVALID",
                "message": turnstile_res.get("message") or "Please complete the human verification and try again.",
            },
        )"""

new_forgot_turnstile = """    turnstile_res = verify_turnstile_token(token_to_verify, expected_action="forgot_password", remote_ip=client_ip)
    if not turnstile_res["success"]:
        err_code = "TURNSTILE_EXPIRED" if "timeout-or-duplicate" in turnstile_res.get("error_codes", []) else "TURNSTILE_INVALID"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": err_code,
                "message": turnstile_res.get("message") or "Security verification failed. Please try again.",
            },
        )"""

if old_forgot_turnstile in auth_py:
    auth_py = auth_py.replace(old_forgot_turnstile, new_forgot_turnstile)
    print("Updated forgot password turnstile check in backend/routers/auth.py")

with open("backend/routers/auth.py", "w", encoding="utf-8") as f:
    f.write(auth_py)
print("Saved backend/routers/auth.py")
