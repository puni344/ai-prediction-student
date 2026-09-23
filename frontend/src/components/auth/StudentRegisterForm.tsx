import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Cpu, Eye, EyeOff, Lock, Mail, User, Hash, ArrowRight } from "lucide-react";
import { authService } from "../../services/api";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { PasswordStrengthMeter, isPasswordValid } from "./PasswordStrengthMeter";
import { TurnstileWidget, TurnstileWidgetRef } from "../common/TurnstileWidget";
import { extractErrorMessage } from "../../utils/errors";

export const StudentRegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const resetTurnstile = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const validateField = (field: string, val: string): string | null => {
    switch (field) {
      case "fullName":
        if (!val.trim()) return "Please enter your full name.";
        return null;
      case "rollNumber":
        if (!val.trim()) return "Roll number is required.";
        if (val.trim().length < 2 || !/^[A-Za-z0-9\-_]+$/.test(val.trim())) {
          return "Roll number must be alphanumeric (hyphens/underscores allowed, minimum 2 characters).";
        }
        return null;
      case "email":
        if (!val.trim()) return "Please enter your institutional email.";
        if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(val.trim())) {
          return "Please enter a valid email address.";
        }
        return null;
      case "password":
        if (!val) return "Password is required.";
        if (!isPasswordValid(val)) {
          return "Password must have at least 8 characters, an uppercase letter, lowercase letter, number, and special character.";
        }
        return null;
      case "confirmPassword":
        if (!val) return "Please confirm your password.";
        if (val !== password) return "Passwords do not match.";
        return null;
      default:
        return null;
    }
  };

  const handleBlur = (field: string, val: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, val);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleChange = (field: string, val: string, setter: (v: string) => void) => {
    setter(val);
    if (touchedFields[field]) {
      const err = validateField(field, val);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next[field] = err;
        else delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) {
      return;
    }
    setGeneralError(null);

    // 1. Client-side field validation
    const errors: Record<string, string> = {};
    const nameErr = validateField("fullName", fullName);
    if (nameErr) errors.fullName = nameErr;
    const rollErr = validateField("rollNumber", rollNumber);
    if (rollErr) errors.rollNumber = rollErr;
    const emailErr = validateField("email", email);
    if (emailErr) errors.email = emailErr;
    const pwErr = validateField("password", password);
    if (pwErr) errors.password = pwErr;
    const cpErr = validateField("confirmPassword", confirmPassword);
    if (cpErr) errors.confirmPassword = cpErr;

    setTouchedFields({
      fullName: true,
      rollNumber: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!captchaToken) {
      setGeneralError("Please complete the human verification challenge.");
      return;
    }

    setIsLoading(true);

    try {
      await authService.signup({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        roll_number: rollNumber.trim().toUpperCase(),
        role: "student",
        captcha_token: captchaToken || undefined,

      });

      // On successful signup, navigate to OTP verification
      navigate(`/student/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
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
    }
  };

  return (
    <Card className="border border-white/10 bg-[#0e121b]/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
      <div className="mb-6 flex items-center justify-between border-b border-white/8 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            Student Account Registration
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Create your account to access personalized ML academic forecasting and intelligent scheduling.
          </p>
        </div>
      </div>

      {generalError && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Full Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <User className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => handleChange("fullName", e.target.value, setFullName)}
              onBlur={(e) => handleBlur("fullName", e.target.value)}
              placeholder="e.g. Punith Reddy"
              className={`w-full rounded-xl border bg-white/4 pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden ${
                fieldErrors.fullName
                  ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
                  : "border-white/10 focus:border-indigo-500"
              }`}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.fullName}</p>
          )}
        </div>

        {/* Roll Number */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Roll Number <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Hash className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => handleChange("rollNumber", e.target.value, setRollNumber)}
              onBlur={(e) => handleBlur("rollNumber", e.target.value)}
              placeholder="e.g. 23BFA12006"
              className={`w-full rounded-xl border bg-white/4 pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden ${
                fieldErrors.rollNumber
                  ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
                  : "border-white/10 focus:border-indigo-500"
              }`}
            />
          </div>
          {fieldErrors.rollNumber && (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.rollNumber}</p>
          )}
        </div>

        {/* Institutional Email */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Student Email <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => handleChange("email", e.target.value, setEmail)}
              onBlur={(e) => handleBlur("email", e.target.value)}
              placeholder="student@institution.edu"
              className={`w-full rounded-xl border bg-white/4 pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden ${
                fieldErrors.email
                  ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
                  : "border-white/10 focus:border-indigo-500"
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Password <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => handleChange("password", e.target.value, setPassword)}
              onBlur={(e) => handleBlur("password", e.target.value)}
              placeholder="At least 8 characters..."
              className={`w-full rounded-xl border bg-white/4 pl-10 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden ${
                fieldErrors.password
                  ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
                  : "border-white/10 focus:border-indigo-500"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.password}</p>
          )}
          {password && <PasswordStrengthMeter password={password} />}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Confirm Password <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value, setConfirmPassword)}
              onBlur={(e) => handleBlur("confirmPassword", e.target.value)}
              placeholder="Re-enter your password..."
              className={`w-full rounded-xl border bg-white/4 pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-hidden ${
                fieldErrors.confirmPassword
                  ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
                  : "border-white/10 focus:border-indigo-500"
              }`}
            />
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {/* Turnstile Security Challenge */}
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
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-4 flex items-center justify-center gap-2"
          isLoading={isLoading}
          disabled={isLoading || !captchaToken}
        >
          <span>Continue to Verification</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-400">
        Already registered?{" "}
        <Link to="/student/login" className="font-semibold text-indigo-400 hover:text-indigo-300 underline">
          Sign In
        </Link>
      </div>
    </Card>
  );
};
