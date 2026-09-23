import React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
}

export interface PasswordCriteria {
  label: string;
  met: boolean;
}

export const getPasswordCriteria = (password: string): PasswordCriteria[] => [
  { label: "At least 8 characters", met: password.length >= 8 },
  { label: "At least one uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
  { label: "At least one lowercase letter (a-z)", met: /[a-z]/.test(password) },
  { label: "At least one numeric digit (0-9)", met: /[0-9]/.test(password) },
  { label: "At least one special character (!@#$%^&*)", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
];

export const isPasswordValid = (password: string): boolean => {
  return getPasswordCriteria(password).every((c) => c.met);
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const criteria = getPasswordCriteria(password);
  const metCount = criteria.filter((c) => c.met).length;

  const getStrengthLabel = () => {
    if (metCount === 0) return { text: "Empty", color: "text-slate-500" };
    if (metCount <= 2) return { text: "Weak", color: "text-rose-400" };
    if (metCount <= 4) return { text: "Moderate", color: "text-amber-400" };
    return { text: "Strong", color: "text-emerald-400" };
  };

  const getBarColor = (index: number) => {
    if (index >= metCount) return "bg-white/10";
    if (metCount <= 2) return "bg-rose-500";
    if (metCount <= 4) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const strength = getStrengthLabel();

  return (
    <div className="mt-2.5 space-y-2 rounded-xl border border-white/6 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-medium">Password Security:</span>
        <span className={`font-semibold ${strength.color}`}>{strength.text}</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 h-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-full rounded-full transition-all duration-300 ${getBarColor(i)}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px]">
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {c.met ? (
              <Check className="h-3 w-3 text-emerald-400 shrink-0" />
            ) : (
              <X className="h-3 w-3 text-slate-500 shrink-0" />
            )}
            <span className={c.met ? "text-slate-200" : "text-slate-500"}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
