import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant: "success" | "warning" | "danger" | "neutral";
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
}) => {
  const badgeColors = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    neutral: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-[#0d111a]/85 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-white/16 hover:bg-[#0f1422]/95 hover:shadow-2xl">
      {/* Top micro-highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      {/* Subtle corner glow on hover */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-40" />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-400 transition-colors group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 group-hover:text-indigo-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold tracking-tight text-white">{value}</h3>
        {badge && (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
              badgeColors[badge.variant]
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-400">{subtext}</p>}
    </div>
  );
};
