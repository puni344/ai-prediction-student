import re

# 1. Patch StudentRegisterForm.tsx
with open('frontend/src/components/auth/StudentRegisterForm.tsx', 'r', encoding='utf-8') as f:
    srf = f.read()

if 'extractErrorMessage' not in srf:
    srf = srf.replace(
        'import { TurnstileWidget, TurnstileWidgetRef } from "../common/TurnstileWidget";',
        'import { TurnstileWidget, TurnstileWidgetRef } from "../common/TurnstileWidget";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

old_catch_srf = """    } catch (err: any) {
      resetTurnstile();
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 422 && data?.field_errors) {
        setFieldErrors(data.field_errors);
        setGeneralError("Please correct the errors in the form.");
      } else {
        setGeneralError(
          data?.detail || "Registration failed. Please check your network and try again."
        );
      }
    }"""

new_catch_srf = """    } catch (err: any) {
      resetTurnstile();
      const status = err.response?.status;
      const data = err.response?.data;
      const detail = data?.detail;

      if (typeof detail === "object" && detail !== null) {
        const { code, message, field_errors } = detail;
        if (field_errors && Object.keys(field_errors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...field_errors }));
        }

        if (code === "EMAIL_ALREADY_REGISTERED") {
          setFieldErrors((prev) => ({
            ...prev,
            email: message || "An account with this email already exists.",
          }));
        } else if (code === "ROLL_NUMBER_ALREADY_REGISTERED") {
          setFieldErrors((prev) => ({
            ...prev,
            rollNumber: message || "This roll number is already registered.",
          }));
        } else if (code === "TURNSTILE_INVALID" || code === "TURNSTILE_EXPIRED") {
          setGeneralError(message || "Security verification failed. Please try again.");
        } else if (code === "VALIDATION_ERROR") {
          if (!field_errors || Object.keys(field_errors).length === 0) {
            setGeneralError(message || "Please correct the highlighted fields.");
          }
        } else {
          setGeneralError(message || "Registration failed. Please try again.");
        }
      } else if (typeof detail === "string") {
        setGeneralError(detail);
      } else if (status === 422 && data?.field_errors) {
        setFieldErrors(data.field_errors);
        setGeneralError("Please correct the errors in the form.");
      } else {
        setGeneralError(
          extractErrorMessage(err, "Registration failed. Please check your network and try again.")
        );
      }
    }"""

if old_catch_srf in srf:
    srf = srf.replace(old_catch_srf, new_catch_srf)
    print("SRF: Replaced catch block")
else:
    print("SRF: Warning, old catch not found")

srf = srf.replace('action="signup"', 'action="student_signup"')

with open('frontend/src/components/auth/StudentRegisterForm.tsx', 'w', encoding='utf-8') as f:
    f.write(srf)
print("SRF: Saved")

# 2. Patch CompleteProfilePage.tsx
with open('frontend/src/pages/student/CompleteProfilePage.tsx', 'r', encoding='utf-8') as f:
    cpp = f.read()

if 'extractErrorMessage' not in cpp:
    cpp = cpp.replace(
        'import { getYearOptionsForProgram } from "../../constants/programs";',
        'import { getYearOptionsForProgram } from "../../constants/programs";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

old_catch_cpp = """    } catch (err: any) {
      setSubmitError(
        err.response?.data?.detail || "Failed to save profile. Please check your network and try again."
      );
    }"""

new_catch_cpp = """    } catch (err: any) {
      setSubmitError(
        extractErrorMessage(err, "Failed to save profile. Please check your network and try again.")
      );
    }"""

if old_catch_cpp in cpp:
    cpp = cpp.replace(old_catch_cpp, new_catch_cpp)
    print("CPP: Replaced catch block")
else:
    print("CPP: Warning, old catch not found")

with open('frontend/src/pages/student/CompleteProfilePage.tsx', 'w', encoding='utf-8') as f:
    f.write(cpp)
print("CPP: Saved")

# 3. Patch LoginPage.tsx
with open('frontend/src/pages/auth/LoginPage.tsx', 'r', encoding='utf-8') as f:
    lp = f.read()

if 'extractErrorMessage' not in lp:
    lp = lp.replace(
        'import { Button } from "../../components/common/Button";',
        'import { Button } from "../../components/common/Button";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

old_catch_lp = """    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === "EMAIL_NOT_VERIFIED") {
        setIsUnverified(true);
        setError("Your email address is not verified yet. Please verify your email to access your account.");
      } else {
        setError(detail || "Authentication failed. Check your email and password.");
      }
    }"""

new_catch_lp = """    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const code = typeof detail === "object" ? detail?.code : detail;
      if (code === "EMAIL_NOT_VERIFIED") {
        setIsUnverified(true);
        setError("Your email address is not verified yet. Please verify your email to access your account.");
      } else {
        setError(extractErrorMessage(err, "Authentication failed. Check your email and password."));
      }
    }"""

if old_catch_lp in lp:
    lp = lp.replace(old_catch_lp, new_catch_lp)
    print("LP: Replaced catch block")
else:
    print("LP: Warning, old catch not found")

with open('frontend/src/pages/auth/LoginPage.tsx', 'w', encoding='utf-8') as f:
    f.write(lp)
print("LP: Saved")

# 4. Patch VerifyEmailPage.tsx
with open('frontend/src/pages/auth/VerifyEmailPage.tsx', 'r', encoding='utf-8') as f:
    vep = f.read()

if 'extractErrorMessage' not in vep:
    vep = vep.replace(
        'import { ConnectedOtpInput } from "../../components/auth/ConnectedOtpInput";',
        'import { ConnectedOtpInput } from "../../components/auth/ConnectedOtpInput";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

old_resend_vep = """    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to resend code. Please try again in a few moments.");
    }"""

new_resend_vep = """    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to resend code. Please try again in a few moments."));
    }"""

if old_resend_vep in vep:
    vep = vep.replace(old_resend_vep, new_resend_vep)
    print("VEP: Replaced resend catch block")
else:
    print("VEP: Warning, old resend catch not found")

with open('frontend/src/pages/auth/VerifyEmailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(vep)
print("VEP: Saved")

# 5. Patch ForgotPasswordPage.tsx
with open('frontend/src/pages/auth/ForgotPasswordPage.tsx', 'r', encoding='utf-8') as f:
    fpp = f.read()

if 'extractErrorMessage' not in fpp:
    fpp = fpp.replace(
        'import { TurnstileWidget, TurnstileWidgetRef } from "../../components/common/TurnstileWidget";',
        'import { TurnstileWidget, TurnstileWidgetRef } from "../../components/common/TurnstileWidget";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

fpp = fpp.replace(
    'setError(err.response?.data?.detail || "Unable to process password reset. Please try again.");',
    'setError(extractErrorMessage(err, "Unable to process password reset. Please try again."));'
)
fpp = fpp.replace(
    'setError(err.response?.data?.detail || "Failed to resend code. Please wait a moment.");',
    'setError(extractErrorMessage(err, "Failed to resend code. Please wait a moment."));'
)
fpp = fpp.replace(
    'setError(detail || "Failed to reset password. Please try again.");',
    'setError(extractErrorMessage(err, "Failed to reset password. Please try again."));'
)

with open('frontend/src/pages/auth/ForgotPasswordPage.tsx', 'w', encoding='utf-8') as f:
    f.write(fpp)
print("FPP: Saved")

# 6. Patch StudentProfilePage.tsx
with open('frontend/src/pages/student/StudentProfilePage.tsx', 'r', encoding='utf-8') as f:
    spp = f.read()

if 'extractErrorMessage' not in spp:
    spp = spp.replace(
        'import { getYearOptionsForProgram } from "../../constants/programs";',
        'import { getYearOptionsForProgram } from "../../constants/programs";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

spp = spp.replace(
    'setErrorMessage(err.response?.data?.detail || "Failed to load student profile");',
    'setErrorMessage(extractErrorMessage(err, "Failed to load student profile"));'
)
spp = spp.replace(
    'setErrorMessage(err.response?.data?.detail || "Failed to save profile changes.");',
    'setErrorMessage(extractErrorMessage(err, "Failed to save profile changes."));'
)

with open('frontend/src/pages/student/StudentProfilePage.tsx', 'w', encoding='utf-8') as f:
    f.write(spp)
print("SPP: Saved")

# 7. Patch PredictionPage.tsx
with open('frontend/src/pages/student/PredictionPage.tsx', 'r', encoding='utf-8') as f:
    pred = f.read()

if 'extractErrorMessage' not in pred:
    pred = pred.replace(
        'import { useAuth } from "../../context/AuthContext";',
        'import { useAuth } from "../../context/AuthContext";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

pred = pred.replace(
    'setError(err.response?.data?.detail || "Failed to load academic snapshot data.");',
    'setError(extractErrorMessage(err, "Failed to load academic snapshot data."));'
)
pred = pred.replace(
    'setError(err.response?.data?.detail || "What-If calculation failed.");',
    'setError(extractErrorMessage(err, "What-If calculation failed."));'
)

with open('frontend/src/pages/student/PredictionPage.tsx', 'w', encoding='utf-8') as f:
    f.write(pred)
print("PredictionPage: Saved")

# 8. Patch PerformanceAnalysisPage.tsx
with open('frontend/src/pages/student/PerformanceAnalysisPage.tsx', 'r', encoding='utf-8') as f:
    pap = f.read()

if 'extractErrorMessage' not in pap:
    pap = pap.replace(
        'import { predictionService } from "../../services/api";',
        'import { predictionService } from "../../services/api";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

pap = pap.replace(
    'setError(err?.response?.data?.detail || "Failed to load performance analysis data.");',
    'setError(extractErrorMessage(err, "Failed to load performance analysis data."));'
)

with open('frontend/src/pages/student/PerformanceAnalysisPage.tsx', 'w', encoding='utf-8') as f:
    f.write(pap)
print("PAP: Saved")

# 9. Patch AIAdvisorPage.tsx
with open('frontend/src/pages/student/AIAdvisorPage.tsx', 'r', encoding='utf-8') as f:
    ai = f.read()

if 'extractErrorMessage' not in ai:
    ai = ai.replace(
        'import { chatService } from "../../services/api";',
        'import { chatService } from "../../services/api";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

old_ai_catch = """      } catch (err: any) {
        setChatError(
          err.response?.data?.detail ||
            "We couldn't load your academic insight right now. Please try again."
        );
      }"""

new_ai_catch = """      } catch (err: any) {
        setChatError(
          extractErrorMessage(err, "We couldn't load your academic insight right now. Please try again.")
        );
      }"""

if old_ai_catch in ai:
    ai = ai.replace(old_ai_catch, new_ai_catch)
    print("AIAdvisor: Replaced catch block")
else:
    print("AIAdvisor: Warning, old catch not found")

with open('frontend/src/pages/student/AIAdvisorPage.tsx', 'w', encoding='utf-8') as f:
    f.write(ai)
print("AIAdvisor: Saved")

# 10. Patch GoogleProfileCompletionModal.tsx
with open('frontend/src/components/auth/GoogleProfileCompletionModal.tsx', 'r', encoding='utf-8') as f:
    gcm = f.read()

if 'extractErrorMessage' not in gcm:
    gcm = gcm.replace(
        'import { authService } from "../../services/api";',
        'import { authService } from "../../services/api";\nimport { extractErrorMessage } from "../../utils/errors";'
    )

gcm = gcm.replace(
    'setError(err.response?.data?.detail || "Failed to update profile. That roll number may already be registered.");',
    'setError(extractErrorMessage(err, "Failed to update profile. That roll number may already be registered."));'
)

with open('frontend/src/components/auth/GoogleProfileCompletionModal.tsx', 'w', encoding='utf-8') as f:
    f.write(gcm)
print("GoogleProfileCompletionModal: Saved")

print("ALL FRONTEND COMPONENTS PATCHED SUCCESSFULLY!")
