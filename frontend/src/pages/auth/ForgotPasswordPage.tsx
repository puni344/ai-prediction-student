import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, Eye, EyeOff, Cpu, KeyRound } from "lucide-react";
import { authService } from "../../services/api";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { ConnectedOtpInput } from "../../components/auth/ConnectedOtpInput";
import { TurnstileWidget, TurnstileWidgetRef } from "../../components/common/TurnstileWidget";
import { extractErrorMessage } from "../../utils/errors";
import { PasswordStrengthMeter, isPasswordValid } from "../../components/auth/PasswordStrengthMeter";

interface ForgotPasswordPageProps {
  portalRole?: "student" | "faculty";
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ portalRole }) => {
  const isFaculty = portalRole === "faculty" || (typeof window !== "undefined" && window.location.pathname.includes("/faculty"));

  const navigate = useNavigate();

  // Step 1: Email, Step 2: OTP, Step 3: Create New Password, Step 4: Success
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const resetTurnstile = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // OTP status
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying" | "success" | "error" | "expired">("idle");
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const maxAttempts = 5;

  // In-flight guard and request sequence tracking
  const isSubmittingOtpRef = useRef(false);
  const otpSequenceRef = useRef(0);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Timers
  const [timeLeft, setTimeLeft] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (currentStep === 2) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setOtpStatus("expired");
            return 0;
          }
          return prev - 1;
        });
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStep]);

  // STEP 1: Submit email to request reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email || !email.includes("@")) {
      setError("Please specify a valid email address.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the human verification challenge.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.forgotPassword({ email: email.trim().toLowerCase(), captcha_token: captchaToken || undefined });
      if (res.next_step === "no_account") {
        // Explicit requirement: Stay on Step 1, do NOT navigate to OTP page
        setError("No account was found with that email address.");
      } else if (res.next_step === "verify_reset_otp") {
        setCurrentStep(2);
        setTimeLeft(300);
        setResendCooldown(60);
        setOtp(["", "", "", "", "", ""]);
        setOtpStatus("idle");
        setSuccessMsg(res.message || "A 6-digit password reset code has been sent to your email.");
      } else {
        setCurrentStep(2);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, "Unable to process password reset. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verify reset OTP
  const handleVerifyOtp = async (codeToSubmit?: string) => {
    if (isSubmittingOtpRef.current || otpStatus === "success") {
      return;
    }

    const otpCode = codeToSubmit || otp.join("");
    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setError("Please enter the complete 6-digit reset code.");
      return;
    }

    if (timeLeft === 0) {
      setError("This verification code has expired. Request a new code.");
      setOtpStatus("expired");
      return;
    }

    if (attemptCount >= maxAttempts) {
      setError("Too many incorrect attempts. Please request a new verification code.");
      setOtpStatus("expired");
      return;
    }

    isSubmittingOtpRef.current = true;
    const currentSeq = ++otpSequenceRef.current;

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    setOtpStatus("verifying");

    try {
      const res = await authService.verifyResetOtp({
        email: email.trim().toLowerCase(),
        otp: otpCode,
      });

      if (currentSeq !== otpSequenceRef.current) return;

      setResetToken(res.reset_token);
      setError(null);
      setOtpStatus("success");
      setSuccessMsg("✓ Verification complete");

      setTimeout(() => {
        setCurrentStep(3);
        setError(null);
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      if (currentSeq !== otpSequenceRef.current) return;

      const newAttempts = attemptCount + 1;
      setAttemptCount(newAttempts);
      setOtpStatus("error");
      const detail = err.response?.data?.detail;
      const detailStr = typeof detail === "string" ? detail : "";
      if (detailStr.includes("MAX_ATTEMPTS_EXCEEDED") || newAttempts >= maxAttempts) {
        setOtpStatus("expired");
        setError("Too many incorrect attempts. Please request a new verification code.");
      } else if (detailStr.includes("expired") || timeLeft === 0) {
        setOtpStatus("expired");
        setError("This verification code has expired. Request a new code.");
      } else {
        setError("Incorrect verification code. Please check the code and try again.");
      }
    } finally {
      isSubmittingOtpRef.current = false;
      if (currentSeq === otpSequenceRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);

    try {
      await authService.forgotPassword({ email: email.trim().toLowerCase(), captcha_token: captchaToken || undefined });
      setTimeLeft(300);
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      setAttemptCount(0);
      setOtpStatus("idle");
      setSuccessMsg("A new 6-digit reset code has been dispatched.");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to resend code. Please wait a moment."));
    } finally {
      setIsResending(false);
    }
  };

  // STEP 3: Submit new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resetToken) {
      setError("Reset session has expired or is invalid. Please request a new code.");
      setCurrentStep(1);
      return;
    }

    if (!isPasswordValid(newPassword)) {
      setError("New password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword({
        email: email.trim().toLowerCase(),
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccessMsg("Password changed successfully");
      setCurrentStep(4);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(extractErrorMessage(err, "Failed to reset password. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#07090e] bg-grid-pattern px-4 py-12 sm:px-6 lg:px-8 text-slate-100 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 shadow-lg shadow-indigo-500/15">
            <Cpu className="h-5 w-5 text-indigo-400" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">StudentPredict</span>
        </Link>

        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {currentStep === 1 && "Reset Your Password"}
          {currentStep === 2 && "Enter Recovery Code"}
          {currentStep === 3 && "Create New Password"}
          {currentStep === 4 && "Password Reset Complete"}
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          {currentStep === 1 && "Enter your registered email address to receive a secure recovery code"}
          {currentStep === 2 && `We sent a 6-digit recovery code to ${email}`}
          {currentStep === 3 && "Set a fresh password that has not been used previously"}
          {currentStep === 4 && "Your credentials have been updated securely"}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="border border-white/10 shadow-2xl p-6 sm:p-8">
          {error && currentStep !== 2 && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && currentStep !== 2 && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {currentStep === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Account Email Address <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                      if (error) setError(null);
                    }}
                    placeholder="name@university.edu"
                    className={`w-full rounded-xl border ${
                      emailError ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500" : "border-white/10 bg-white/4 focus:border-indigo-500"
                    } py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500`}
                  />
                </div>
                {emailError && (
                  <p className="mt-1 text-xs text-rose-400 font-medium">{emailError}</p>
                )}
              </div>

              {/* Cloudflare Turnstile Security Verification */}
              <TurnstileWidget
                ref={turnstileRef}
                action="forgot_password"
                onSuccess={(token) => {
                  setCaptchaToken(token);
                  if (error && error.includes("verification")) {
                    setError(null);
                  }
                }}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
              />

              <Button
                type="submit"
                variant="primary"
                className={`w-full mt-2 ${!captchaToken ? "opacity-60 cursor-not-allowed" : ""}`}
                isLoading={isLoading}
                disabled={isLoading || !captchaToken}
              >
                {isLoading ? "Sending reset code..." : "Transmit Reset Code"}
                <ArrowRight className="h-4 w-4 ml-1.5 inline" />
              </Button>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit OTP */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    6-Digit Reset Code
                  </label>
                  <span className={`text-xs font-mono font-medium ${timeLeft < 60 ? "text-rose-400 animate-pulse" : "text-slate-400"}`}>
                    Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                  </span>
                </div>

                <ConnectedOtpInput
                  value={otp}
                  onChange={(newOtp) => {
                    setOtp(newOtp);
                    setError(null);
                    if (otpStatus === "error") setOtpStatus("idle");
                  }}
                  onClearError={() => {
                    setError(null);
                    if (otpStatus === "error") setOtpStatus("idle");
                  }}
                  onComplete={(code) => handleVerifyOtp(code)}
                  status={otpStatus}
                  errorMessage={error}
                  successMessage={successMsg}
                  attemptCount={attemptCount}
                  maxAttempts={maxAttempts}
                  disabled={isLoading || attemptCount >= maxAttempts || otpStatus === "success"}
                />
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
                disabled={otp.join("").length !== 6 || timeLeft === 0 || otpStatus === "success" || attemptCount >= maxAttempts}
                onClick={() => handleVerifyOtp()}
              >
                Verify Code & Continue
                <ArrowRight className="h-4 w-4 ml-1.5 inline" />
              </Button>

              <div className="flex items-center justify-between pt-2 border-t border-white/8 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Change Email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className={`flex items-center gap-1 font-semibold ${
                    resendCooldown > 0 ? "text-slate-600 cursor-not-allowed" : "text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend Code"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Set New Password */}
          {currentStep === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong password"
                    className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-[11px] text-rose-400">
                    Passwords do not match
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-3"
                isLoading={isLoading}
                disabled={!isPasswordValid(newPassword) || newPassword !== confirmPassword}
              >
                Confirm & Update Password
                <KeyRound className="h-4 w-4 ml-1.5 inline" />
              </Button>
            </form>
          )}

          {/* STEP 4: Success Screen */}
          {currentStep === 4 && (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-sm font-semibold text-white">
                Password changed successfully
              </p>
              <p className="text-xs text-slate-300">
                Your password has been successfully updated. You may now sign in with your new credentials.
              </p>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => navigate(isFaculty ? "/faculty/login" : "/student/login")}
              >
                Proceed to Sign In
                <ArrowRight className="h-4 w-4 ml-1.5 inline" />
              </Button>
            </div>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          Remember your password?{" "}
          <Link to={isFaculty ? "/faculty/login" : "/student/login"} className="font-semibold text-indigo-400 hover:text-indigo-300">
            {isFaculty ? "Back to Faculty Sign In" : "Back to Student Sign In"}
          </Link>
        </p>
      </div>
    </div>
  );
};
