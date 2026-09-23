import React, { useEffect, useState } from "react";
import { predictionService } from "../../services/api";
import { PredictionResponse } from "../../types";
import { Card } from "../../components/common/Card";
import { RiskBadge } from "../../components/common/RiskBadge";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { AlertTriangle, ShieldCheck, HeartPulse, Sparkles, CheckCircle2 } from "lucide-react";

export const RiskAnalysisPage: React.FC = () => {
  const [latest, setLatest] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await predictionService.getLatest();
        if (res) {
          setLatest(res);
        }
      } catch {
        // Error
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatest();
  }, []);

  if (isLoading) {
    return <LoadingState message="Analyzing deterministic risk index..." />;
  }

  if (!latest) {
    return (
      <EmptyState
        title="No Risk Data"
        description="Simulate your academic performance to generate risk metrics."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Deterministic Risk Diagnosis</h1>
        <p className="mt-1 text-xs text-slate-400">
          Multi-threshold clinical risk tiering to detect vulnerabilities before exams.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="text-center p-6 flex flex-col items-center justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Current Risk Tier
          </span>
          <RiskBadge level={latest.risk_level} />
        </Card>

        <Card className="text-center p-6 flex flex-col items-center justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Calculated Risk Index
          </span>
          <p className="text-3xl font-black text-white">{latest.risk_index.toFixed(1)}</p>
          <span className="text-[10px] text-slate-500 mt-1">Scale: 0 (Safe) to 100 (Critical)</span>
        </Card>

        <Card className="text-center p-6 flex flex-col items-center justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Pass Probability
          </span>
          <p className="text-3xl font-black text-emerald-400">
            {(latest.pass_probability * 100).toFixed(1)}%
          </p>
          <span className="text-[10px] text-slate-500 mt-1">Threshold: 50.0%</span>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <HeartPulse className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Diagnostic Explanation</h2>
        </div>
        <p className="mt-4 text-sm text-slate-200 leading-relaxed">
          {latest.risk_description}
        </p>

        <div className="mt-6 rounded-xl border border-white/8 bg-white/3 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
            Recommended Action Plan
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              Maintain attendance consistency above 80% to avoid risk penalty.
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              Complete weekly assignments to reinforce test score readiness.
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              Review SHAP negative factors in the Explainability tab.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
