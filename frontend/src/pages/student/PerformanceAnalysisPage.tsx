import React, { useState, useEffect, useCallback } from "react";
import { predictionService } from "../../services/api";
import { extractErrorMessage } from "../../utils/errors";
import { SnapshotTrendResponse, BucketTrendItem } from "../../types";
import { Card } from "../../components/common/Card";
import { LoadingState } from "../../components/common/LoadingState";
import { RiskBadge } from "../../components/common/RiskBadge";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  Info,
  BarChart3,
  HelpCircle,
} from "lucide-react";

type TimeframeTab = "day" | "week" | "month" | "year";

export const PerformanceAnalysisPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TimeframeTab>("day");
  const [trendData, setTrendData] = useState<SnapshotTrendResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async (tab: TimeframeTab) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await predictionService.getTrends(tab);
      setTrendData(data);
    } catch (err: any) {
      console.error("Failed to fetch performance analysis data:", err);
      setError(extractErrorMessage(err, "Failed to load performance analysis data."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends(activeTab);
  }, [activeTab, fetchTrends]);

  const handleTabChange = (tab: TimeframeTab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  const sufficiency = trendData?.data_sufficiency;
  const isInsufficient = sufficiency?.status === "insufficient" || sufficiency?.status === "empty" || (trendData && trendData.total_days < 2);
  const buckets: BucketTrendItem[] = trendData?.bucket_trends || [];
  const validBuckets = buckets.filter((b) => b.has_data !== false && b.avg_predicted_score !== null);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-indigo-400" />
            Performance Analysis
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track how your predicted academic performance changes over time.
          </p>
        </div>

        {/* Range Selector Tabs: DAY, WEEK, MONTH, YEAR */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {(["day", "week", "month", "year"] as TimeframeTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {tab === "day" && "Day (30d)"}
              {tab === "week" && "Week (5w)"}
              {tab === "month" && "Month"}
              {tab === "year" && "Year (12m)"}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Range Clarification Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          {activeTab === "day" && (
            <span>
              <strong>Day View:</strong> Displays daily performance snapshots recorded over the last 30 calendar days. Only days with recorded snapshots are shown; no artificial zero values are fabricated.
            </span>
          )}
          {activeTab === "week" && (
            <span>
              <strong>Week View:</strong> Aggregates snapshots across exactly 5 calendar-week buckets ending with the current week.
            </span>
          )}
          {activeTab === "month" && (
            <span>
              <strong>Month View:</strong> Aggregates snapshots by calendar month for each month containing recorded academic data.
            </span>
          )}
          {activeTab === "year" && (
            <span>
              <strong>Year View:</strong> Displays performance aggregated across exactly 12 consecutive calendar months.
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Aggregating official performance snapshots..." />
      ) : error ? (
        <div className="p-6 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm">
          {error}
        </div>
      ) : isInsufficient ? (
        /* Insufficient Data State */
        <Card className="p-12 text-center space-y-4 border-dashed border-slate-800 bg-slate-900/40">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Not Enough Data Yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {sufficiency?.message ||
                `Only ${trendData?.total_days || 0} daily snapshot available. Performance analysis requires at least 2 recorded daily snapshots to calculate a meaningful trajectory.`}
            </p>
          </div>
          <div className="text-xs text-slate-500 max-w-lg mx-auto pt-2">
            The platform records exactly ONE official academic snapshot per day at 09:00 AM Asia/Kolkata.
            As you continue your studies, historical trends will automatically accumulate here.
          </div>
        </Card>
      ) : (
        /* Slices & Metrics Display */
        <div className="space-y-8">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Average Predicted Score */}
            <Card className="bg-slate-900/70 border-slate-800 p-5 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Average Predicted Score
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {trendData?.avg_predicted_score ?? "--"}
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Arithmetic mean across {trendData?.total_days} recorded snapshot(s)
              </p>
            </Card>

            {/* Score Trajectory / Change */}
            <Card className="bg-slate-900/70 border-slate-800 p-5 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Performance Trajectory
              </span>
              <div className="flex items-baseline gap-2">
                {trendData?.score_change !== null && trendData?.score_change !== undefined ? (
                  <>
                    <span
                      className={`text-3xl font-black flex items-center gap-1 ${
                        trendData.score_change >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {trendData.score_change >= 0 ? (
                        <TrendingUp className="w-6 h-6 inline" />
                      ) : (
                        <TrendingDown className="w-6 h-6 inline" />
                      )}
                      {trendData.score_change >= 0 ? `+${trendData.score_change}` : trendData.score_change}
                    </span>
                    <span className="text-xs text-slate-400">pts</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-400">--</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 capitalize">
                Pattern: {trendData?.improvement_pattern?.replace("_", " ") || "Stable"}
              </p>
            </Card>

            {/* Risk Days Distribution */}
            <Card className="bg-slate-900/70 border-slate-800 p-5 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Risk Days Distribution
              </span>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {trendData?.risk_distribution?.LOW || 0} Low
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {trendData?.risk_distribution?.MODERATE || 0} Mod
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {trendData?.risk_distribution?.HIGH || 0} High
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Categorized by official daily risk level
              </p>
            </Card>

            {/* Study Consistency */}
            <Card className="bg-slate-900/70 border-slate-800 p-5 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Study Consistency
              </span>
              <div className="text-xl font-bold text-indigo-300 pt-1">
                {trendData?.study_consistency || "Consistent"}
              </div>
              <p className="text-[11px] text-slate-500">
                Based on daily study duration variance
              </p>
            </Card>
          </div>

          {/* Longitudinal Chart / Buckets Table */}
          <Card className="p-6 bg-slate-900/80 border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Longitudinal Performance Trend ({activeTab.toUpperCase()})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visual breakdown of predicted scores and daily study metrics across {activeTab} intervals.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                {validBuckets.length} interval{validBuckets.length !== 1 ? "s" : ""} recorded
              </span>
            </div>

            {/* Simple Dynamic SVG Bar / Line Chart */}
            {validBuckets.length > 0 && (
              <div className="space-y-4">
                <div className="h-48 w-full flex items-end gap-2 pt-6 pb-2 border-b border-slate-800/80 px-2 overflow-x-auto">
                  {validBuckets.map((bucket, idx) => {
                    const score = bucket.avg_predicted_score || 0;
                    const heightPercent = Math.max(10, Math.min(100, score));
                    const isLast = idx === validBuckets.length - 1;

                    return (
                      <div
                        key={bucket.bucket_key}
                        className="flex-1 min-w-[50px] max-w-[90px] flex flex-col items-center gap-2 group h-full justify-end"
                      >
                        <span className="text-[10px] font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                          {score.toFixed(1)}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 relative ${
                            isLast
                              ? "bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-md shadow-indigo-500/20"
                              : "bg-slate-700 hover:bg-slate-600"
                          }`}
                        >
                          {bucket.risk_level && (
                            <div className="absolute top-1 left-1/2 -translate-x-1/2">
                              <span
                                className={`w-2 h-2 rounded-full block ${
                                  bucket.risk_level === "LOW"
                                    ? "bg-emerald-400"
                                    : bucket.risk_level === "MODERATE"
                                    ? "bg-amber-400"
                                    : "bg-rose-400"
                                }`}
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-full">
                          {bucket.bucket_label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Interval Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Period / Date</th>
                    <th className="py-2.5 px-3 font-semibold">Predicted Score</th>
                    <th className="py-2.5 px-3 font-semibold">Risk Category</th>
                    <th className="py-2.5 px-3 font-semibold">Study Hours</th>
                    <th className="py-2.5 px-3 font-semibold">Attendance</th>
                    <th className="py-2.5 px-3 font-semibold">Snapshots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {validBuckets.map((bucket) => (
                    <tr key={bucket.bucket_key} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-white font-medium">
                        {bucket.bucket_label}
                        {bucket.sub_label && (
                          <span className="text-[10px] text-slate-500 ml-1.5">
                            ({bucket.sub_label})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                        {bucket.avg_predicted_score !== null ? `${bucket.avg_predicted_score.toFixed(1)} / 100` : "--"}
                      </td>
                      <td className="py-2.5 px-3">
                        {bucket.risk_level ? (
                          <RiskBadge level={bucket.risk_level as any} />
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        {bucket.avg_study_hours !== null ? `${bucket.avg_study_hours} hrs` : "--"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        {bucket.avg_attendance !== null ? `${bucket.avg_attendance}%` : "--"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {bucket.snapshot_count} snapshot{bucket.snapshot_count !== 1 ? "s" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 3. Authoritative Formula Definitions Block (Requirement 13) */}
          <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Deterministic Aggregation Formulas
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
              <div>
                <strong className="text-slate-200">Average Predicted Score:</strong>{" "}
                Arithmetic mean of all recorded daily predicted scores within the chosen timeframe:{" "}
                <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-[11px]">
                  sum(predicted_scores) / count(snapshots)
                </code>
              </div>
              <div>
                <strong className="text-slate-200">Performance Trajectory:</strong>{" "}
                Net change between the latest recorded score and the earliest recorded score in the timeframe:{" "}
                <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded text-[11px]">
                  latest_score - starting_score
                </code>
              </div>
              <div>
                <strong className="text-slate-200">Risk Days Count:</strong>{" "}
                Exact tally of daily snapshots categorized into LOW, MODERATE, or HIGH risk tiers by the ML consensus engine.
              </div>
              <div>
                <strong className="text-slate-200">Study Consistency:</strong>{" "}
                Deterministic calculation measuring standard deviation of daily study hours (&lt; 1.0 hr = High Consistency, 1.0–2.0 hrs = Moderate, &gt;= 2.0 hrs = Variable).
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
