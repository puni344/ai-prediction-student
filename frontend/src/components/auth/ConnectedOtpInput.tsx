import React, { useRef, useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

export interface ConnectedOtpInputProps {
  value: string[];
  onChange: (otp: string[]) => void;
  onComplete?: (otpString: string) => void;
  onClearError?: () => void;
  status?: "idle" | "verifying" | "success" | "error" | "expired";
  errorMessage?: string | null;
  successMessage?: string | null;
  attemptCount?: number;
  maxAttempts?: number;
  disabled?: boolean;
}

export const ConnectedOtpInput: React.FC<ConnectedOtpInputProps> = ({
  value,
  onChange,
  onComplete,
  onClearError,
  status = "idle",
  errorMessage,
  successMessage,
  attemptCount = 0,
  maxAttempts = 5,
  disabled = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first empty cell or cell 0 on mount
  useEffect(() => {
    const firstEmpty = value.findIndex((d) => !d);
    const targetIdx = firstEmpty !== -1 ? firstEmpty : 0;
    inputRefs.current[targetIdx]?.focus();
  }, []);

  const isSuccess = status === "success";
  const isErr = status === "error";
  const isExpired = status === "expired" || attemptCount >= maxAttempts;
  const isActionDisabled = disabled || isExpired || status === "verifying" || isSuccess;

  const handleDigitInput = (index: number, digitChar: string) => {
    if (isActionDisabled) return;

    const newOtp = [...value];
    while (newOtp.length < 6) newOtp.push("");
    newOtp[index] = digitChar;
    onChange(newOtp);
    onClearError?.();

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    } else if (index === 5) {
      // 6th cell just filled: verify if all 6 cells are digits
      const isFull = newOtp.length === 6 && newOtp.every((d) => d.length === 1 && /^\d$/.test(d));
      if (isFull) {
        const code = newOtp.join("");
        onComplete?.(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isActionDisabled) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const newOtp = [...value];
      while (newOtp.length < 6) newOtp.push("");

      if (newOtp[index]) {
        // Clear current cell
        newOtp[index] = "";
        onChange(newOtp);
        onClearError?.();
      } else if (index > 0) {
        // Move to previous cell and clear it
        newOtp[index - 1] = "";
        onChange(newOtp);
        onClearError?.();
        inputRefs.current[index - 1]?.focus();
        inputRefs.current[index - 1]?.select();
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      inputRefs.current[index - 1]?.select();
      return;
    }

    if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      const newOtp = [...value];
      while (newOtp.length < 6) newOtp.push("");
      newOtp[index] = "";
      onChange(newOtp);
      onClearError?.();
      return;
    }

    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      handleDigitInput(index, e.key);
      return;
    }
  };

  const handleChange = (index: number, val: string) => {
    if (isActionDisabled) return;

    if (!val) {
      const newOtp = [...value];
      while (newOtp.length < 6) newOtp.push("");
      newOtp[index] = "";
      onChange(newOtp);
      onClearError?.();
      return;
    }

    const cleanDigits = val.replace(/\D/g, "");
    if (!cleanDigits) return;

    if (cleanDigits.length >= 6) {
      handleFullCode(cleanDigits.slice(0, 6));
    } else {
      handleDigitInput(index, cleanDigits.slice(-1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (isActionDisabled) return;

    const pasted = e.clipboardData.getData("text").trim();
    const cleanDigits = pasted.replace(/\D/g, "");
    if (cleanDigits.length >= 6) {
      handleFullCode(cleanDigits.slice(0, 6));
    }
  };

  const handleFullCode = (code: string) => {
    if (isActionDisabled) return;
    const digits = code.slice(0, 6).split("");
    onChange(digits);
    onClearError?.();
    inputRefs.current[5]?.focus();
    onComplete?.(code);
  };

  const filledCount = value.filter((d) => d && /^\d$/.test(d)).length;

  return (
    <div className="w-full space-y-4">
      {/* 6 Connected Circular OTP Cells */}
      <div className="relative flex items-center justify-center gap-2 sm:gap-3 py-3 select-none" onPaste={handlePaste}>
        {/* Background connector line */}
        <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-0.5 bg-white/10 z-0" />
        <div
          className="absolute top-1/2 left-8 -translate-y-1/2 h-0.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-300 z-0"
          style={{
            width: `${(filledCount / 6) * 82}%`,
          }}
        />

        {Array.from({ length: 6 }).map((_, idx) => {
          const digit = value[idx] || "";
          const isFilled = digit.length > 0;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <input
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                disabled={isActionDisabled}
                value={digit}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                aria-label={`Digit ${idx + 1} of 6`}
                className={`h-12 w-12 sm:h-13 sm:w-13 text-center text-xl font-bold font-mono rounded-full border transition-all duration-200 shadow-md ${
                  isSuccess
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30"
                    : isErr
                    ? "border-rose-500 bg-rose-500/15 text-rose-300 ring-2 ring-rose-500/30"
                    : isFilled
                    ? "border-indigo-400 bg-indigo-600/20 text-white ring-2 ring-indigo-500/30"
                    : "border-white/15 bg-white/5 text-white hover:border-white/30 focus:border-indigo-400 focus:bg-indigo-500/10 focus:ring-2 focus:ring-indigo-500/40"
                } focus:outline-hidden`}
              />
              {/* Connector dot indicator */}
              <div
                className={`mt-1.5 h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  isSuccess
                    ? "bg-emerald-400 scale-125"
                    : isFilled
                    ? "bg-indigo-400"
                    : "bg-white/10"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Attempt Counter Badge */}
      {attemptCount > 0 && !isSuccess && (
        <div className="flex justify-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            attemptCount >= maxAttempts
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
          }`}>
            Attempt {attemptCount} of {maxAttempts}
          </span>
        </div>
      )}

      {/* Status Notifications */}
      {status === "verifying" && (
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-cyan-300 animate-pulse">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Verifying code...</span>
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage || "✓ Verification complete"}</span>
        </div>
      )}

      {isErr && errorMessage && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
