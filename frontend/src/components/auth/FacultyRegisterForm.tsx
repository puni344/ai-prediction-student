import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Cpu, Eye, EyeOff, Lock, Mail, User, Briefcase, Building2, ArrowRight } from "lucide-react";
import { authService } from "../../services/api";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { PasswordStrengthMeter, isPasswordValid } from "./PasswordStrengthMeter";
import { MultiDepartmentSelector } from "../common/MultiDepartmentSelector";
import { TurnstileWidget, TurnstileWidgetRef } from "../common/TurnstileWidget";

export const FacultyRegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const [fullName, setFullName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [email, setEmail] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const resetTurnstile = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const validateField = (field: string, val: any): string | null => {
    switch (field) {
      case "fullName":
        if (!val || !val.trim()) return "Please enter your full name.";
        return null;
      case "facultyId":
        if (!val || !val.trim()) return "Faculty ID is required.";
        if (val.trim().length < 2) return "Faculty ID must be at least 2 characters.";
        return null;
      case "email":
        if (!val || !val.trim()) return "Please enter a valid email address.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
          return "Please enter a valid email address.";
        }
        return null;
      case "departments":
        if (!val || !Array.isArray(val) || val.length === 0) return "Please select at least one academic department.";
        return null;
      case "password":
        if (!val) return "Password is required.";
        if (!isPasswordValid(val)) {
          return "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.";
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

  const handleBlur = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    let val: any = "";
    if (field === "fullName") val = fullName;
    else if (field === "facultyId") val = facultyId;
    else if (field === "email") val = email;
    else if (field === "departments") val = departments;
    else if (field === "password") val = password;
    else if (field === "confirmPassword") val = confirmPassword;

    const err = validateField(field, val);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleChange = (field: string, val: any) => {
    if (field === "fullName") setFullName(val);
    else if (field === "facultyId") setFacultyId(val);
    else if (field === "email") setEmail(val);
    else if (field === "departments") setDepartments(val);
    else if (field === "password") {
      setPassword(val);
      if (confirmPassword) {
        const cpErr = val !== confirmPassword ? "Passwords do not match." : null;
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (cpErr) next.confirmPassword = cpErr;
          else delete next.confirmPassword;
          return next;
        });
      }
    } else if (field === "confirmPassword") {
      setConfirmPassword(val);
    }

    if (generalError) setGeneralError(null);

    // Live validation update
    if (touchedFields[field] || fieldErrors[field] || fieldErrors.faculty_id || (field === "email" && fieldErrors.email)) {
      const err = validateField(field, val);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) {
          next[field] = err;
        } else {
          delete next[field];
          if (field === "facultyId") delete next.faculty_id;
        }
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // 1. Client validation
    const errors: Record<string, string> = {};
    const nameErr = validateField("fullName", fullName);
    if (nameErr) errors.fullName = nameErr;
    const facErr = validateField("facultyId", facultyId);
    if (facErr) errors.facultyId = facErr;
    const emailErr = validateField("email", email);
    if (emailErr) errors.email = emailErr;
    const deptErr = validateField("departments", departments);
    if (deptErr) errors.departments = deptErr;
    const pwErr = validateField("password", password);
    if (pwErr) errors.password = pwErr;
    const cpErr = validateField("confirmPassword", confirmPassword);
    if (cpErr) errors.confirmPassword = cpErr;

    setTouchedFields({
      fullName: true,
      facultyId: true,
      email: true,
      departments: true,
      password: true,
      confirmPassword: true,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // DO NOT SUBMIT & DO NOT CONSUME / RESET TURNSTILE
      return;
    }

    if (!captchaToken) {
      setGeneralError("Please complete the human verification challenge.");
      return;
    }

    setIsLoading(true);

    try {
      await authService.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: "faculty",
        faculty_id: facultyId.trim().toUpperCase(),
        departments,
        captcha_token: captchaToken || undefined,
      });

      // Navigate to faculty OTP verification page
      navigate(`/faculty/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
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
          resetTurnstile();
        } else if (code === "FACULTY_ID_ALREADY_REGISTERED") {
          setFieldErrors((prev) => ({
            ...prev,
            facultyId: message || "This Faculty ID is already registered.",
          }));
          resetTurnstile();
        } else if (code === "TURNSTILE_INVALID" || code === "TURNSTILE_EXPIRED") {
          setGeneralError(message || "Security verification failed. Please try again.");
          resetTurnstile();
        } else if (code === "EMAIL_DELIVERY_FAILED") {
          setGeneralError("We couldn't send your verification email. Please try again later.");
          resetTurnstile();
        } else if (code === "VALIDATION_ERROR") {
          if (!field_errors || Object.keys(field_errors).length === 0) {
            setGeneralError(message || "Please correct the highlighted fields.");
          }
        } else {
          setGeneralError(message || "Something went wrong while creating your account. Please try again.");
          resetTurnstile();
        }
      } else if (typeof detail === "string") {
        const lower = detail.toLowerCase();
        if (lower.includes("email already exists") || (lower.includes("already registered") && lower.includes("email"))) {
          setFieldErrors((prev) => ({ ...prev, email: "An account with this email already exists." }));
          resetTurnstile();
        } else if (lower.includes("faculty id") && lower.includes("already registered")) {
          setFieldErrors((prev) => ({ ...prev, facultyId: "This Faculty ID is already registered." }));
          resetTurnstile();
        } else if (lower.includes("human verification") || lower.includes("turnstile")) {
          setGeneralError("Security verification failed. Please try again.");
          resetTurnstile();
        } else if (lower.includes("could not be sent") || lower.includes("couldn't send")) {
          setGeneralError("We couldn't send your verification email. Please try again later.");
          resetTurnstile();
        } else {
          setGeneralError(detail);
          resetTurnstile();
        }
      } else if (!err.response) {
        setGeneralError("Could not connect to the server. Please check your connection and try again.");
      } else {
        setGeneralError("Something went wrong while creating your account. Please try again.");
        resetTurnstile();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 shadow-lg shadow-cyan-500/15">
            <Cpu className="h-5 w-5 text-cyan-400" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">StudentPredict</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 mb-2">
          <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
          <span>Faculty Portal</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Faculty Registration
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Create an institutional account to supervise student trajectories and academic cohorts
        </p>
      </div>

      <Card className="border border-white/10 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
        {generalError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
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
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                onBlur={() => handleBlur("fullName")}
                placeholder="Dr. Alan Turing"
                className={`w-full rounded-xl border ${
                  fieldErrors.fullName ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-cyan-500"
                } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden`}
              />
            </div>
            {fieldErrors.fullName && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{fieldErrors.fullName}</p>
            )}
          </div>

          {/* Faculty ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Faculty ID / Employee ID <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-cyan-300 font-mono">Unique Institutional ID</span>
            </div>
            <div className="relative">
              <Briefcase className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={facultyId}
                onChange={(e) => handleChange("facultyId", e.target.value.toUpperCase())}
                onBlur={() => handleBlur("facultyId")}
                placeholder="FAC-CS-042"
                className={`w-full rounded-xl border ${
                  fieldErrors.facultyId || fieldErrors.faculty_id
                    ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
                    : "border-white/10 bg-white/4 focus:border-cyan-500"
                } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden font-mono uppercase`}
              />
            </div>
            {(fieldErrors.facultyId || fieldErrors.faculty_id) && (
              <p className="mt-1 text-xs text-rose-400 font-medium">
                {fieldErrors.facultyId || fieldErrors.faculty_id}
              </p>
            )}
          </div>

          {/* Institutional Email Address */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Institutional Email Address <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="alan.turing@university.edu"
                className={`w-full rounded-xl border ${
                  fieldErrors.email ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-cyan-500"
                } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden`}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{fieldErrors.email}</p>
            )}
          </div>

          {/* Multi-Department Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Academic Department <span className="text-rose-400">*</span>
            </label>
            <MultiDepartmentSelector
              values={departments}
              onChange={(depts) => handleChange("departments", depts)}
              error={fieldErrors.departments}
              hideLabel={true}
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                placeholder="Enter strong password"
                className={`w-full rounded-xl border ${
                  fieldErrors.password ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-cyan-500"
                } py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-hidden`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{fieldErrors.password}</p>
            )}
            <PasswordStrengthMeter password={password} />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Confirm Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                placeholder="Confirm password"
                className={`w-full rounded-xl border ${
                  fieldErrors.confirmPassword ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-cyan-500"
                } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden`}
              />
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {/* Cloudflare Turnstile */}
          <TurnstileWidget
            ref={turnstileRef}
            action="faculty_signup"
            onSuccess={(token) => {
              setCaptchaToken(token);
              if (generalError && generalError.includes("verification")) {
                setGeneralError(null);
              }
            }}
            onError={() => {
              setCaptchaToken(null);
            }}
            onExpire={() => {
              setCaptchaToken(null);
            }}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isLoading}
            disabled={isLoading || !captchaToken}
          >
            {isLoading ? "Creating account..." : "Create Faculty Account"}
            {!isLoading && <ArrowRight className="h-4 w-4 ml-1.5 inline" />}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{" "}
            <Link to="/faculty/login" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              Sign in to Faculty Console
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
