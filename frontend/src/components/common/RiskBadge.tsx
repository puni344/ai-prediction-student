import React from "react";

interface RiskBadgeProps {
  level: "LOW" | "MODERATE" | "HIGH" | string;
  showDot?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, showDot = true }) => {
  const upper = level.toUpperCase();
  const styles = {
    LOW: {
      pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-xs shadow-emerald-500/10",
      dot: "bg-emerald-400 shadow-sm shadow-emerald-400",
    },
    MODERATE: {
      pill: "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-xs shadow-amber-500/10",
      dot: "bg-amber-400 shadow-sm shadow-amber-400",
    },
    HIGH: {
      pill: "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-xs shadow-rose-500/20",
      dot: "bg-rose-400 shadow-sm shadow-rose-400 animate-ping",
    },
  }[upper] || {
    pill: "bg-slate-800 text-slate-300 border-slate-700",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide backdrop-blur-md ${styles.pill}`}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.dot}`} />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        </span>
      )}
      {upper} RISK
    </span>
  );
};
