import React from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { getYearOptionsForProgram, getProgramByNameOrId } from "../../constants/programs";

interface AcademicYearSelectorProps {
  programId?: string;
  value: string;
  onChange: (year: string) => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
  notice?: string | null;
}

export const AcademicYearSelector: React.FC<AcademicYearSelectorProps> = ({
  programId,
  value,
  onChange,
  error,
  disabled = false,
  required = true,
  hideLabel = false,
  notice,
}) => {
  const options = getYearOptionsForProgram(programId);
  const progObj = getProgramByNameOrId(programId);

  return (
    <div className="relative">
      {!hideLabel && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Current Year {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || !programId}
          className={`w-full appearance-none rounded-xl border bg-white/4 py-2.5 pl-3.5 pr-10 text-sm transition-colors focus:outline-hidden ${
            error
              ? "border-rose-500/80 bg-rose-500/5 focus:border-rose-500"
              : "border-white/10 focus:border-indigo-500"
          } ${!value ? "text-slate-500" : "text-white"} ${
            disabled || !programId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <option value="" disabled className="bg-[#0e121b] text-slate-500">
            {!programId ? "Select program first" : "Select current year"}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-[#0e121b] text-white">
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {notice && (
        <p className="mt-1 text-xs text-amber-400 font-medium flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{notice}</span>
        </p>
      )}

      {error && !notice && (
        <p className="mt-1 text-xs text-rose-400 font-medium">{error}</p>
      )}
    </div>
  );
};
