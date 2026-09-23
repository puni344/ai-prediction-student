import React, { useState } from "react";
import { Clock, Zap, ArrowRight, Tag, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { RecommendationItem } from "../../types";

interface AIInsightCardProps {
  item: RecommendationItem;
  rank: number;
}

export const AIInsightCard: React.FC<AIInsightCardProps> = ({ item, rank }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const priorityColors = {
    high: {
      border: "border-rose-500/30 hover:border-rose-500/50",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      accent: "from-rose-500/10 to-transparent",
      dot: "bg-rose-500",
    },
    medium: {
      border: "border-amber-500/30 hover:border-amber-500/50",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accent: "from-amber-500/10 to-transparent",
      dot: "bg-amber-500",
    },
    low: {
      border: "border-emerald-500/30 hover:border-emerald-500/50",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accent: "from-emerald-500/10 to-transparent",
      dot: "bg-emerald-500",
    },
  }[item.priority];

  const handleCopy = () => {
    const text = `${item.title}\n\nWhy it matters: ${item.reason}\n\nAction Plan: ${item.action}\n\nDuration: ${item.duration_minutes}m/day`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group relative rounded-2xl border ${priorityColors.border} bg-slate-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5`}
    >
      {/* Top accent gradient line */}
      <div
        className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${priorityColors.accent}`}
      />

      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 border border-slate-700">
            #{rank}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityColors.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priorityColors.dot}`} />
            {item.priority} Priority
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-mono">{item.duration_minutes}m/day</span>
          </div>
          <div className="flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-slate-300 font-mono text-[11px]">
            <Zap className="h-3 w-3 text-amber-400" />
            <span>P: {item.priority_score.toFixed(1)}</span>
          </div>
          <button
            onClick={handleCopy}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Copy recommendation"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors leading-snug">
        {item.title}
      </h4>

      <p className="mt-2 text-xs text-slate-300 leading-relaxed">
        {item.reason}
      </p>

      {/* Concrete Action Box */}
      <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-100 flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-cyan-300">Action Plan: </span>
          {item.action}
        </div>
      </div>

      {/* Source Factor Chips */}
      {item.source_factors && item.source_factors.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-800/60 text-[11px] text-slate-400">
          <Tag className="h-3 w-3 text-slate-400 shrink-0" />
          <span className="text-[10px] text-slate-400 font-medium">Based on:</span>
          {item.source_factors.map((factor) => (
            <span
              key={factor}
              className="rounded-md bg-slate-800/70 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700/50"
            >
              {factor.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
