import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { DEPARTMENTS, DepartmentOption } from "../../constants/departments";

interface MultiDepartmentSelectorProps {
  values: string[];
  onChange: (values: string[]) => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
}

export const MultiDepartmentSelector: React.FC<MultiDepartmentSelectorProps> = ({
  values,
  onChange,
  error,
  disabled = false,
  required = true,
  hideLabel = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = DEPARTMENTS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDept = (name: string) => {
    if (values.includes(name)) {
      onChange(values.filter((v) => v !== name));
    } else {
      onChange([...values, name]);
    }
  };

  const removeDept = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((v) => v !== name));
  };

  return (
    <div className="relative" ref={containerRef}>
      {!hideLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Academic Department(s) {required && <span className="text-rose-400">*</span>}
          </label>
          <span className="text-[11px] text-slate-500">
            {values.length} selected (multi-select)
          </span>
        </div>
      )}

      {/* Selected department pills */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-300"
            >
              <span className="truncate max-w-[200px]">{val}</span>
              <button
                type="button"
                onClick={(e) => removeDept(val, e)}
                className="hover:text-rose-400 transition-colors"
                title="Remove department"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Selector Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-xl border bg-white/4 py-2.5 px-3.5 text-sm text-left transition-colors ${
          error
            ? "border-rose-500/50 focus:border-rose-500"
            : isOpen
            ? "border-indigo-500 ring-1 ring-indigo-500"
            : "border-white/10 hover:border-white/20"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={values.length > 0 ? "text-white font-medium truncate" : "text-slate-500"}>
          {values.length > 0
            ? `${values.length} department${values.length > 1 ? "s" : ""} assigned`
            : "Select your departments"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            isOpen ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-white/12 bg-[#0e121b] p-2 shadow-2xl backdrop-blur-xl">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/8 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {filtered.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-500">No departments found.</p>
            ) : (
              filtered.map((d) => {
                const isSelected = values.includes(d.name);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDept(d.name)}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors text-left ${
                      isSelected
                        ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{d.name}</span>
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ml-2 transition-colors ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-white/20 bg-transparent"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
