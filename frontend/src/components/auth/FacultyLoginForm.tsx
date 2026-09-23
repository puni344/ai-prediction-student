import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Cpu, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { TurnstileWidget, TurnstileWidgetRef } from "../common/TurnstileWidget";

export const FacultyLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
  }, []);

  const resetTurnstile = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const validateField = (field: string, val: string): string | null => {
    if (field === "email") {
      if (!val.trim()) return "Please enter a valid email address.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
        return "Please enter a valid email address.";
      }
      return null;
    }
    if (field === "password") {
      if (!val) return "Password is required.";
      return null;
    }
    return null;
  };

  const handleBlur = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const val = field === "email" ? email : password;
    const err = validateField(field, val);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleChange = (field: string, val: string) => {
    if (field === "email") setEmail(val);
    else setPassword(val);

    if (generalError) setGeneralError(null);

    if (touchedFields[field] || fieldErrors[field]) {
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
    setGeneralError(null);

    // 1. Client-side field validation
    const errors: Record<string, string> = {};
    const emailErr = validateField("email", email);
    if (emailErr) errors.email = emailErr;
    const pwErr = validateField("password", password);
    if (pwErr) errors.password = pwErr;

    setTouchedFields({ email: true, password: true });

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
      const data = await authService.login({
        email: email.trim().toLowerCase(),
        password,
        captcha_token: captchaToken || undefined,
        expected_role: "faculty",
      });

      // Strict client-side defense-in-depth role check
      if (data.role !== "faculty") {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setGeneralError("These credentials cannot be used with this account type.");
        resetTurnstile();
        setIsLoading(false);
        return;
      }

      await login(data.access_token, data.role);
      navigate("/faculty/dashboard");
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      const detail = data?.detail;

      if (typeof detail === "object" && detail !== null) {
        const { code, message, field_errors } = detail;
        if (field_errors && Object.keys(field_errors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...field_errors }));
        }

        if (code === "INVALID_ACCOUNT_TYPE") {
          setGeneralError(message || "These credentials cannot be used with this account type.");
          resetTurnstile();
        } else if (code === "INVALID_CREDENTIALS") {
          setGeneralError("Incorrect email or password.");
          resetTurnstile();
        } else if (status === 401) {
          setGeneralError(message || "Incorrect email or password.");
          resetTurnstile();
        } else if (code === "TURNSTILE_INVALID" || code === "TURNSTILE_EXPIRED") {
          setGeneralError(message || "Security verification failed. Please try again.");
          resetTurnstile();
        } else if (code === "EMAIL_NOT_VERIFIED") {
          setGeneralError("Please verify your email before logging in.");
          resetTurnstile();
        } else if (code === "VALIDATION_ERROR") {
          if (!field_errors || Object.keys(field_errors).length === 0) {
            setGeneralError(message || "Please check your inputs.");
          }
        } else {
          setGeneralError(message || "Incorrect email or password.");
          resetTurnstile();
        }
      } else if (typeof detail === "string") {
        const lower = detail.toLowerCase();
        if (lower.includes("cannot be used with this account type") || lower.includes("account type")) {
          setGeneralError("These credentials cannot be used with this account type.");
          resetTurnstile();
        } else if (lower.includes("invalid") && (lower.includes("credential") || lower.includes("password") || lower.includes("email"))) {
          setGeneralError("Incorrect email or password.");
          resetTurnstile();
        } else if (lower.includes("human verification") || lower.includes("turnstile")) {
          setGeneralError("Security verification failed. Please try again.");
          resetTurnstile();
        } else if (lower.includes("email_not_verified") || lower.includes("verify your email")) {
          setGeneralError("Please verify your email before logging in.");
          resetTurnstile();
        } else {
          setGeneralError(detail);
          resetTurnstile();
        }
      } else if (!err.response) {
        setGeneralError("Could not connect to the server. Please check your connection and try again.");
      } else {
        setGeneralError("Incorrect email or password.");
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
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Faculty Console
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Sign in to access cohort analytics, student advisories, and grading predictions
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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Institutional Email <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="faculty@university.edu"
                className={`w-full rounded-xl border ${
                  fieldErrors.email ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-cyan-500"
                } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden`}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password <span className="text-rose-400">*</span>
              </label>
              <Link to="/forgot-password" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                placeholder="••••••••"
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
          </div>

          <TurnstileWidget
            ref={turnstileRef}
            action="faculty_login"
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
            {isLoading ? "Signing in..." : "Sign In to Faculty Console"}
            {!isLoading && <ArrowRight className="h-4 w-4 ml-1.5 inline" />}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0e121b] px-3 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="mt-4">
            <GoogleSignInButton />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            Don't have a faculty account?{" "}
            <Link to="/faculty/register" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              Create Faculty Account
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
