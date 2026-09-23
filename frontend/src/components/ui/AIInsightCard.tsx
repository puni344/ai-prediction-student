import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";

interface AIInsightCardProps {
  title: string;
  insight: string;
  impact?: "positive" | "negative" | "neutral";
  recommendation?: string;
  actionText?: string;
  onAction?: () => void;
}

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  title,
  insight,
  impact = "neutral",
  recommendation,
  actionText,
  onAction,
}) => {
  const borderStyles = {
    positive: "border-emerald-500/30 bg-emerald-500/5",
    negative: "border-rose-500/30 bg-rose-500/5",
    neutral: "border-indigo-500/30 bg-indigo-500/5",
  }[impact];

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl ${borderStyles}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">{title}</h4>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">{insight}</p>

      {recommendation && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/4 p-3">
          <p className="text-xs text-slate-400 leading-normal">
            <strong className="text-white">AI Strategy:</strong> {recommendation}
          </p>
        </div>
      )}

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {actionText}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
