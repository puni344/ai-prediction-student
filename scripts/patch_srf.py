with open("frontend/src/components/auth/StudentRegisterForm.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Replace turnstile JSX
old_turnstile = """        {/* Turnstile Security Challenge */}
        <div className="pt-2">
          <TurnstileWidget
            ref={turnstileRef}
            onSuccess={(token) => {
              setCaptchaToken(token);
              setGeneralError(null);
            }}
            onError={() => {
              setCaptchaToken(null);
              setGeneralError("Verification service connection failed. Please reload.");
            }}
            onExpire={() => {
              setCaptchaToken(null);
              setGeneralError("Verification expired. Please verify again.");
            }}
            action="student_signup"
          />
        </div>"""

new_turnstile = """        {/* Turnstile Security Challenge */}
        <div className="pt-2">
          <TurnstileWidget
            ref={turnstileRef}
            action="student_signup"
            onSuccess={(token) => {
              setCaptchaToken(token);
              setGeneralError((prev) => (prev?.includes("verification") || prev?.includes("human") ? null : prev));
            }}
            onError={() => {
              setCaptchaToken(null);
            }}
            onExpire={() => {
              setCaptchaToken(null);
            }}
          />
        </div>"""

if old_turnstile in c:
    c = c.replace(old_turnstile, new_turnstile)
    print("Replaced TurnstileWidget JSX in StudentRegisterForm.tsx")
else:
    print("Warning: old_turnstile JSX not found exactly")

# Add isSubmittingRef
if "isSubmittingRef" not in c:
    c = c.replace(
        "const [isLoading, setIsLoading] = useState(false);",
        "const [isLoading, setIsLoading] = useState(false);\n  const isSubmittingRef = useRef(false);"
    )

# Replace handleSubmit
old_submit_start = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);"""

new_submit_start = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) {
      return;
    }
    setGeneralError(null);"""

if old_submit_start in c:
    c = c.replace(old_submit_start, new_submit_start)
    print("Added single-submit check to handleSubmit")

# Update catch in handleSubmit
import re
catch_pattern = r'\} catch \(err: any\) \{.*?finally \{'
catch_replacement = """} catch (err: any) {
      // Clear token and reset Turnstile for fresh verification (preserve all inputs)
      setCaptchaToken(null);
      turnstileRef.current?.reset();

      const status = err.response?.status;
      const data = err.response?.data;
      const detail = data?.detail;

      if (!err.response) {
        setGeneralError("Registration service is currently unavailable. Please try again.");
      } else if (typeof detail === "object" && detail !== null) {
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
        } else if (code === "TURNSTILE_EXPIRED") {
          setGeneralError("Security verification has expired. Please verify again.");
        } else if (code === "TURNSTILE_INVALID") {
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
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }"""

c = re.sub(catch_pattern, catch_replacement, c, flags=re.DOTALL)

# Button disabled check
c = c.replace(
    'disabled={isLoading}',
    'disabled={isLoading || !captchaToken}'
)
c = c.replace(
    'className="w-full mt-4 flex items-center justify-center gap-2"\n          isLoading={isLoading}\n        >',
    'className="w-full mt-4 flex items-center justify-center gap-2"\n          isLoading={isLoading}\n          disabled={isLoading || !captchaToken}\n        >'
)

with open("frontend/src/components/auth/StudentRegisterForm.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Saved StudentRegisterForm.tsx successfully")
