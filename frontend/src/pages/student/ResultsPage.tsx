import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PredictionResponse } from "../../types";
import { predictionService } from "../../services/api";
import { Card } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { RiskBadge } from "../../components/common/RiskBadge";
import { SHAPChart } from "../../components/charts/SHAPChart";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/common/Button";
import { RadialScoreMeter } from "../../components/ui/RadialScoreMeter";
import { SpotlightCard } from "../../components/ui/SpotlightCard";
import { ArrowRight, Sparkles, AlertTriangle, Cpu, CheckCircle2 } from "lucide-react";

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [latest, setLatest] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await predictionService.getLatest();
      setLatest(res);
    } catch (err: any) {
      console.error("Failed to fetch latest prediction:", err);
      setError("Prediction service is currently unavailable. Please check your connection or try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  if (isLoading) {
    return <LoadingState message="Extracting prediction outcomes and TreeSHAP values..." />;
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <div className="p-6 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            Service Unavailable
          </div>
          <p>{error}</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => fetchLatest()}>
              Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/student/dashboard")}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!latest) {
    return (
      <EmptyState
        title="No Predictions Executed"
        description="Run a performance simulation to view multi-model consensus, TreeSHAP feature attributions, and risk assessment."
        actionText="Run Simulation"
        onAction={() => navigate("/student/prediction")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Latest Prediction Outcome</h1>
          <p className="mt-1 text-xs text-slate-400">
            Authoritative inference computed on {new Date(latest.created_at).toLocaleString()}
          </p>
        </div>
        <Link to="/student/prediction">
          <Button variant="outline" size="sm">
            Run Another Simulation
          </Button>
        </Link>
      </div>

      {/* Main Score Showcase */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SpotlightCard className="flex flex-col items-center justify-center p-8 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Consensus Score
          </span>
          <RadialScoreMeter
            score={latest.predicted_score}
            passProbability={latest.pass_probability}
            riskLevel={latest.risk_level}
            size={180}
          />
          <div className="mt-4 flex items-center gap-2">
            <RiskBadge level={latest.risk_level} />
            <span className="text-xs font-semibold text-slate-300">{latest.pass_fail} status</span>
          </div>
        </SpotlightCard>

        {/* Multi-Model Cross-Validation Cards */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-400" />
                Ensemble Architecture Cross-Validation
              </span>
              <span className="text-[11px] text-slate-400">Deterministic Consistency: True</span>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium">
                Regressor: <strong className="text-white">{latest.performance_model || "Tuned Random Forest Regressor"}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                Classifier: <strong className="text-white">{latest.pass_fail_model || "Tuned Random Forest Classifier"}</strong>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {Object.entries(latest.model_comparison || {}).map(([modelName, data]) => (
                <div key={modelName} className="rounded-xl border border-white/8 bg-white/3 p-3.5 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                    {modelName}
                  </span>
                  <p className="mt-1 text-2xl font-black text-white">{data.predicted_score.toFixed(1)}%</p>
                  <span className="text-[10px] font-bold text-emerald-400 block mt-0.5">
                    {data.pass_fail || "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Deterministic Risk Diagnosis
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">
                Index: {latest.risk_index.toFixed(1)} / 100
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              {latest.risk_description}
            </p>
          </Card>
        </div>
      </div>

      {/* SHAP Feature Drivers */}
      <Card>
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            TreeSHAP Point Attribution
          </span>
          <Link to="/student/explainability" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            Deep Dive →
          </Link>
        </div>
        <div className="mt-4">
          <SHAPChart
            positive={latest.top_positive}
            negative={latest.top_negative}
            baseValue={latest.base_value}
          />
        </div>
      </Card>
    </div>
  );
};
