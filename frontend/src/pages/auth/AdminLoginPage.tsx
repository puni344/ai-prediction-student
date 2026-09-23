import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, Building2, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { TurnstileWidget, TurnstileWidgetRef } from "../../components/common/TurnstileWidget";

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, role, isLoading: authLoading } = useAuth();
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  useEffect(() => {
    if (!authLoading && isAuthenticated && role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, role, authLoading, navigate]);

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
      setGeneralError("Please complete the security verification challenge.");
      return;
    }

    setIsLoading(true);
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");

      const data = await authService.login({
        email: email.trim().toLowerCase(),
        password,
        captcha_token: captchaToken || undefined,
        expected_role: "admin",
      });

      if (data.role !== "admin") {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setGeneralError("These credentials cannot be used with this account type.");
        resetTurnstile();
        setIsLoading(false);
        return;
      }

      await login(data.access_token, data.role);
      navigate("/admin/dashboard", { replace: true });
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
    <div className="relative flex min-h-screen flex-col justify-center bg-[#07090e] bg-grid-pattern px-4 py-12 sm:px-6 lg:px-8 text-slate-100 overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-600/10 blur-[130px] rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-orange-500/20 shadow-lg shadow-amber-500/15">
            <Building2 className="h-6 w-6 text-amber-400" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">StudentPredict</span>
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 mb-3">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Institution Portal • Main Admin</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Administrator Sign In
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Restricted to the authorized institutional administrator
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
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
                Administrator Email <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  placeholder="admin@institution.edu"
                  className={`w-full rounded-xl border ${
                    fieldErrors.email ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-amber-500"
                  } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-rose-400 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Master Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  placeholder="Enter administrator password"
                  className={`w-full rounded-xl border ${
                    fieldErrors.password ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-amber-500"
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

            {/* Cloudflare Turnstile Security Verification */}
            <TurnstileWidget
              ref={turnstileRef}
              action="admin_login"
              onSuccess={(token) => {
                setCaptchaToken(token);
                if (generalError && generalError.includes("verification")) {
                  setGeneralError(null);
                }
              }}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              isLoading={isLoading}
              disabled={isLoading || !captchaToken}
            >
              {isLoading ? "Signing in..." : "Sign In to Admin Portal"}
              {!isLoading && <ArrowRight className="h-4 w-4 ml-1.5 inline" />}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
