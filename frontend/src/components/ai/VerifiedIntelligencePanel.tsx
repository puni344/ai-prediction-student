import React from "react";
import { ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, Award, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { RecommendationResponse } from "../../types";

interface VerifiedIntelligencePanelProps {
  data: RecommendationResponse | null;
  shapPositive?: Array<{ feature: string; contribution: number }>;
  shapNegative?: Array<{ feature: string; contribution: number }>;
  loading?: boolean;
}

export const VerifiedIntelligencePanel: React.FC<VerifiedIntelligencePanelProps> = ({
  data,
  shapPositive = [],
  shapNegative = [],
  loading = false,
}) => {
  if (loading || !data || !data.prediction_context) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl animate-pulse space-y-4">
        <div className="h-5 w-48 bg-slate-800 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-slate-800/50 rounded-xl" />
          <div className="h-20 bg-slate-800/50 rounded-xl" />
          <div className="h-20 bg-slate-800/50 rounded-xl" />
          <div className="h-20 bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  const ctx = data.prediction_context;
  const score = typeof ctx.predicted_score === "number" ? ctx.predicted_score : 0;
  const passProb = typeof ctx.pass_probability === "number" ? ctx.pass_probability : 0;
  const risk = ctx.risk_level || "LOW";
  const riskIndex = typeof ctx.risk_index === "number" ? ctx.risk_index : 0;

  const riskBadgeColors = {
    LOW: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    MODERATE: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    HIGH: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  }[risk as "LOW" | "MODERATE" | "HIGH"] || "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 backdrop-blur-xl shadow-xl space-y-5">
      {/* Header with Visual Authority Distinction */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Verified Model Context
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Locked ML outputs from Random Forest & TreeSHAP
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          Backend Ground Truth
        </span>
      </div>

      {/* 4 Core Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Predicted Score */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <span className="text-[11px] font-medium text-slate-400 block">Predicted Score</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {score.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
        </div>

        {/* Pass Probability */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <span className="text-[11px] font-medium text-slate-400 block">Pass Probability</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {(passProb * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Risk Classification */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <span className="text-[11px] font-medium text-slate-400 block">Risk Tier</span>
          <div className="mt-1">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold font-mono uppercase tracking-wider ${riskBadgeColors}`}
            >
              {risk}
            </span>
          </div>
        </div>

        {/* Risk Index */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <span className="text-[11px] font-medium text-slate-400 block">Risk Index</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {riskIndex.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 ml-1 font-mono">/ 100</span>
          </div>
        </div>
      </div>

      {/* Top SHAP Drivers */}
      {(shapPositive.length > 0 || shapNegative.length > 0) && (
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Key Feature Attributions (TreeSHAP)
          </span>
          <div className="space-y-1.5 text-xs font-mono">
            {shapPositive.slice(0, 2).map((item) => (
              <div key={item.feature} className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                  <span className="capitalize">{item.feature.replace(/_/g, " ")}</span>
                </span>
                <span className="text-emerald-400 font-semibold">
                  +{item.contribution.toFixed(2)} pts
                </span>
              </div>
            ))}
            {shapNegative.slice(0, 1).map((item) => (
              <div key={item.feature} className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-rose-400" />
                  <span className="capitalize">{item.feature.replace(/_/g, " ")}</span>
                </span>
                <span className="text-rose-400 font-semibold">
                  {item.contribution.toFixed(2)} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Structural Distinction Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 text-[11px] text-slate-400 flex items-start gap-2">
        <Award className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-snug">
          <strong className="text-slate-300">Architectural Authority:</strong> Numerical predictions are authoritatively locked by the ML system. Gemini provides guidance grounded strictly in these verified metrics.
        </p>
      </div>
    </div>
  );
};
