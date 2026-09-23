import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, AlertCircle, Cpu, ArrowRight, GraduationCap, Briefcase } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { Button } from "../../components/common/Button";
import { extractErrorMessage } from "../../utils/errors";
import { Card } from "../../components/common/Card";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";

interface LoginPageProps {
  portalRole?: "student" | "faculty";
}

export const LoginPage: React.FC<LoginPageProps> = ({ portalRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Determine portal type from prop or path
  const isStudentPortal = portalRole === "student" || location.pathname.includes("/student");
  const isFacultyPortal = portalRole === "faculty" || location.pathname.includes("/faculty");
  const expectedPortalRole: "student" | "faculty" | undefined = portalRole || (isFacultyPortal ? "faculty" : isStudentPortal ? "student" : undefined);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUnverified(false);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await authService.login({
        email,
        password,
        expected_role: expectedPortalRole,
      });

      if (expectedPortalRole && data.role !== expectedPortalRole) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setError("These credentials cannot be used with this account type.");
        setIsLoading(false);
        return;
      }

      await login(data.access_token, data.role);

      if (data.role === "admin") {
        navigate("/admin/dashboard");
      } else if (data.role === "faculty") {
        navigate("/faculty/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const code = typeof detail === "object" ? detail?.code : detail;
      const message = typeof detail === "object" ? detail?.message : detail;
      if (code === "INVALID_ACCOUNT_TYPE") {
        setError(message || "These credentials cannot be used with this account type.");
      } else if (code === "EMAIL_NOT_VERIFIED") {
        setIsUnverified(true);
        setError("Your email address is not verified yet. Please verify your email to access your account.");
      } else {
        setError(extractErrorMessage(err, "Authentication failed. Check your email and password."));
      }
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#07090e] bg-grid-pattern px-4 py-12 sm:px-6 lg:px-8 text-slate-100 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 shadow-lg shadow-indigo-500/15">
            <Cpu className="h-5 w-5 text-indigo-400" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">StudentPredict</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-2">
          {isStudentPortal ? (
            <>
              <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />
              <span>Student Authentication Lab</span>
            </>
          ) : isFacultyPortal ? (
            <>
              <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
              <span>Faculty Authentication Console</span>
            </>
          ) : (
            <>
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>Academic Intelligence Platform</span>
            </>
          )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Welcome back
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Enter credentials to access your academic intelligence dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="border border-white/10 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
                {isUnverified && (
                  <div className="mt-2">
                    <Link
                      to={`/verify-email?email=${encodeURIComponent(email)}`}
                      className="font-bold underline hover:text-white"
                    >
                      Complete Email Verification  
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <Link
                  to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full font-bold shadow-indigo-500/25 mt-2"
            >
              {isLoading ? "Authenticating..." : "Sign In to Console"}
            </Button>
          </form>

          {/* Google Sign-in */}
          <div className="mt-6 border-t border-white/8 pt-6">
            <GoogleSignInButton buttonText="Sign in with Google" />
          </div>



          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{" "}
              <Link to="/signup" className="font-semibold text-indigo-400 hover:text-indigo-300">
                Register here
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
