import React, { useEffect, useState } from "react";
import { predictionService } from "../../services/api";
import { PredictionResponse } from "../../types";
import { Card } from "../../components/common/Card";
import { SHAPChart } from "../../components/charts/SHAPChart";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { AIIntelligenceBanner } from "../../components/ui/AIIntelligenceBanner";
import { Sparkles, TrendingUp, TrendingDown, Info, Sliders, ChevronRight, ShieldCheck, CheckCircle2 } from "lucide-react";

export const ExplainabilityPage: React.FC = () => {
  const [latest, setLatest] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<{ feature: string; contribution: number; isPositive: boolean } | null>(null);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await predictionService.getLatest();
        if (res) {
          setLatest(res);
          if (res.top_positive && res.top_positive.length > 0) {
            setSelectedFeature({
              feature: res.top_positive[0].feature,
              contribution: res.top_positive[0].contribution,
              isPositive: true,
            });
          }
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
    return <LoadingState message="Extracting TreeSHAP game-theoretic decomposition..." />;
  }

  if (!latest) {
    return (
      <EmptyState
        title="No Explainability Data"
        description="Run a simulation to generate exact TreeSHAP attribution charts."
      />
    );
  }

  const topPos = latest.top_positive[0];
  const netAdvantage = latest.top_positive.reduce((acc, f) => acc + f.contribution, 0) +
                       latest.top_negative.reduce((acc, f) => acc + f.contribution, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">TreeSHAP Explainability Console</h1>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-mono text-cyan-300">
              Shapley Decomposition
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Game-theoretic Shapley decomposition quantifying how every feature pushes or pulls your score from baseline.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-300 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Base Population: {latest.base_value.toFixed(2)}%</span>
        </div>
      </div>

      {/* AI Explainability Synthesis */}
      <AIIntelligenceBanner
        category="explanation"
        badge="TREESHAP SYNTHESIS"
        title="Game-Theoretic Feature Attribution Summary"
        strategy={`Positive academic factors generate a net boost of +${netAdvantage.toFixed(2)} pts over the baseline of ${latest.base_value.toFixed(2)}%. Primary positive driver is "${topPos?.feature || 'previous_grade'}" contributing +${topPos?.contribution.toFixed(2) || '0'} pts. Maintaining attendance and sleep consistency insulates against vulnerability regressions.`}
        tags={["TreeSHAP", "AdditiveFeatureAttribution", "ModelAgnostic"]}
        confidence={99.9}
      />

      {/* Main Attribution Chart */}
      <Card className="border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Feature Impact Waterfall (Additive Points from Baseline)
          </span>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Positive
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> Negative
            </span>
          </div>
        </div>
        <div className="mt-4">
          <SHAPChart
            positive={latest.top_positive}
            negative={latest.top_negative}
            baseValue={latest.base_value}
          />
        </div>
      </Card>

      {/* Interactive Feature Decomposition & Lens */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Positive Drivers */}
        <div className="lg:col-span-4">
          <Card className="h-full border-emerald-500/20 bg-gradient-to-b from-[#0e1718] to-[#0a0d14]">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Top Positive Factors</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                SCORE BOOSTS
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {latest.top_positive.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFeature({ feature: f.feature, contribution: f.contribution, isPositive: true })}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    selectedFeature?.feature === f.feature
                      ? "bg-emerald-500/15 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-200 font-medium">{f.feature}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400">+{f.contribution.toFixed(3)} pts</span>
                    <ChevronRight className="h-3 w-3 text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Negative Drags */}
        <div className="lg:col-span-4">
          <Card className="h-full border-rose-500/20 bg-gradient-to-b from-[#180e12] to-[#0a0d14]">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Top Vulnerability Factors</h3>
              </div>
              <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                SCORE DRAGS
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {latest.top_negative.length > 0 ? (
                latest.top_negative.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedFeature({ feature: f.feature, contribution: f.contribution, isPositive: false })}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedFeature?.feature === f.feature
                        ? "bg-rose-500/15 border-rose-500/40 shadow-sm shadow-rose-500/10"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-200 font-medium">{f.feature}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-rose-400">{f.contribution.toFixed(3)} pts</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 rounded-xl border border-white/5 bg-white/2 text-center text-xs text-slate-400">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <span>No negative drag factors detected. High overall resilience!</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Feature Inspector Lens */}
        <div className="lg:col-span-4">
          <Card className="h-full border-cyan-500/20 bg-[#0c101c] p-5">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Info className="h-4 w-4 text-cyan-400" />
                Feature Diagnostic Lens
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                INSPECTOR
              </span>
            </div>

            {selectedFeature ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SELECTED ATTRIBUTE</div>
                  <div className="text-base font-bold text-white mt-0.5 font-mono">{selectedFeature.feature}</div>
                </div>

                <div className="rounded-xl border border-white/5 bg-black/30 p-3.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">NET MATHEMATICAL CONTRIBUTION</div>
                  <div className={`text-2xl font-black font-mono mt-1 ${selectedFeature.isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedFeature.isPositive ? `+${selectedFeature.contribution.toFixed(3)}` : selectedFeature.contribution.toFixed(3)} pts
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Calculated via exact TreeSHAP path integration over all CatBoost, XGBoost, and Random Forest split decisions.
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300">
                  <span className="font-semibold text-white block mb-1">Prescriptive Guidance:</span>
                  {selectedFeature.isPositive
                    ? "Protect this key strength. Maintaining steady consistency here shields your score from unexpected exam variance."
                    : "Prioritize strategic recovery in this dimension. Even a modest increment significantly suppresses risk tier probability."}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Select any factor from the left to view detailed Shapley attribution.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
