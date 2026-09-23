import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, ArrowRight, RefreshCw, Cpu, CheckCircle2, AlertCircle } from "lucide-react";
import { authService, systemService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { ConnectedOtpInput } from "../../components/auth/ConnectedOtpInput";
import { extractErrorMessage } from "../../utils/errors";

interface VerifyEmailPageProps {
  portalRole?: "student" | "faculty";
}

const maskEmailAddress = (rawEmail: string): string => {
  if (!rawEmail || !rawEmail.includes("@")) return rawEmail;
  const [local, domain] = rawEmail.split("@");
  if (local.length <= 2) return `${local}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ portalRole }) => {
  const isFaculty = portalRole === "faculty" || (typeof window !== "undefined" && window.location.pathname.includes("/faculty"));

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error" | "expired">("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const maxAttempts = 5;

  // In-flight submission guard and request sequencing to prevent duplicate / out-of-order race conditions
  const isSubmittingRef = useRef(false);
  const sequenceRef = useRef(0);

  // 5-minute expiry timer (300 seconds)
  const [timeLeft, setTimeLeft] = useState(300);
  // 60-second resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [isMockEmail, setIsMockEmail] = useState(false);

  useEffect(() => {
    systemService.getEmailMode().then((res) => setIsMockEmail(res.is_mock)).catch(() => {});
  }, []);

  // Countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerify = async (otpCodeToSubmit?: string) => {
    // Guard against duplicate concurrent calls or already verified state
    if (isSubmittingRef.current || status === "success") {
      return;
    }

    const otpCode = otpCodeToSubmit || otp.join("");
    if (!email) {
      setError("Email address is required.");
      return;
    }
    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    if (timeLeft === 0) {
      setError("This verification code has expired. Request a new code.");
      setStatus("expired");
      return;
    }
    if (attemptCount >= maxAttempts) {
      setError("Too many incorrect attempts. Please request a new verification code.");
      setStatus("expired");
      return;
    }

    isSubmittingRef.current = true;
    const currentSeq = ++sequenceRef.current;

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    setStatus("verifying");

    try {
      const data = await authService.verifyEmail({ email: email.trim().toLowerCase(), otp: otpCode });

      // Stale response check: discard if a newer request was dispatched
      if (currentSeq !== sequenceRef.current) return;

      setError(null);
      setStatus("success");
      setSuccessMsg("✓ Verification complete");

      // Update auth context
      await login(data.access_token, data.role);

      // Redirect
      setTimeout(() => {
        if (data.role === "faculty") {
          navigate("/faculty/dashboard", { replace: true });
        } else if (data.requires_profile_completion) {
          navigate("/student/complete-profile", { replace: true });
        } else {
          navigate("/student/dashboard", { replace: true });
        }
      }, 1000);
    } catch (err: any) {
      // Stale response check: discard if a newer request was dispatched
      if (currentSeq !== sequenceRef.current) return;

      const newAttempts = attemptCount + 1;
      setAttemptCount(newAttempts);
      setStatus("error");

      const detail = err.response?.data?.detail;
      const detailStr = typeof detail === "string" ? detail : "";

      if (detailStr.includes("MAX_ATTEMPTS_EXCEEDED") || newAttempts >= maxAttempts) {
        setStatus("expired");
        setError("Too many incorrect attempts. Please request a new verification code.");
      } else if (detailStr.includes("OTP_EXPIRED") || timeLeft === 0) {
        setStatus("expired");
        setError("This verification code has expired. Request a new code.");
      } else {
        setError("Incorrect verification code. Please check the code and try again.");
      }
    } finally {
      isSubmittingRef.current = false;
      if (currentSeq === sequenceRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending || isSubmittingRef.current) return;
    if (!email) {
      setError("Please specify an email address.");
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await authService.resendVerification({ email: email.trim().toLowerCase() });
      setResendCooldown(60);
      setTimeLeft(300);
      setOtp(["", "", "", "", "", ""]);
      setAttemptCount(0);
      setStatus("idle");
      setSuccessMsg("A fresh 6-digit verification code has been sent to your email.");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to resend code. Please try again in a few moments."));
    } finally {
      setIsResending(false);
    }
  };

  const isFormComplete = otp.length === 6 && otp.every((d) => d.length === 1 && /^\d$/.test(d));

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#07090e] bg-grid-pattern px-4 py-12 sm:px-6 lg:px-8 text-slate-100 overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Portal Indicator */}
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 mb-3 shadow-lg shadow-indigo-500/20">
            <Cpu className="h-6 w-6" />
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${
            isFaculty
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          }`}>
            {isFaculty ? "Faculty Verification" : "Student Verification"}
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            Verify Your Email
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            We dispatched a 6-digit cryptographic security code to:
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-indigo-300">
            {maskEmailAddress(email)}
          </p>
        </div>

        <Card className="border border-white/10 bg-[#0e121b]/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="space-y-6"
          >
            <ConnectedOtpInput
              value={otp}
              onChange={(newOtp) => {
                setOtp(newOtp);
                setError(null);
                if (status === "error") setStatus("idle");
              }}
              onClearError={() => {
                setError(null);
                if (status === "error") setStatus("idle");
              }}
              onComplete={(code) => handleVerify(code)}
              status={status}
              errorMessage={error}
              successMessage={successMsg}
              attemptCount={attemptCount}
              maxAttempts={maxAttempts}
              disabled={isLoading || status === "success"}
            />

            {/* Explicit Verify Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2"
              isLoading={isLoading}
              disabled={!isFormComplete || status === "success" || status === "expired" || attemptCount >= maxAttempts}
            >
              <span>Verify & Enter Console</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* Timers and Actions */}
          <div className="space-y-3 pt-2 border-t border-white/8 text-center text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Code Expiration</span>
              <span className={`font-mono font-bold ${timeLeft < 60 ? "text-rose-400" : "text-slate-200"}`}>
                {formatTime(timeLeft)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className={`font-semibold transition-colors flex items-center gap-1 ${
                  resendCooldown > 0 || isResending
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-indigo-400 hover:text-indigo-300 underline"
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
