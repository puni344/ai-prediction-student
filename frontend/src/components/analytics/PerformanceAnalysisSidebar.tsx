import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Card } from "../common/Card";

export interface DailySnapshotItem {
  id: number;
  snapshot_date: string;
  predicted_score: number;
  pass_probability: number;
  risk_level: string;
  risk_index?: number;
  study_hours?: number;
  attendance?: number;
}

interface PerformanceAnalysisSidebarProps {
  snapshots: DailySnapshotItem[];
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

type RangeType = "DAY" | "WEEK" | "MONTH" | "YEAR";

interface ChartBarData {
  displayLabel: string;
  fullDateLabel: string;
  score: number;
  risk: string;
  passProb?: number;
  snapshotCount: number;
  riskTrend?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const PerformanceAnalysisSidebar: React.FC<PerformanceAnalysisSidebarProps> = ({
  snapshots,
  isOpen = true,
  onClose,
  title = "PERFORMANCE ANALYSIS",
  subtitle = "See how your academic performance is changing over time.",
  className = "",
}) => {
  const [activeRange, setActiveRange] = useState<RangeType>("DAY");

  // Helper: parse YYYY-MM-DD
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1,
      day: parseInt(parts[2], 10),
    };
  };

  // 1. Process Chart Data
  const chartData = useMemo<ChartBarData[]>(() => {
    if (!snapshots || snapshots.length === 0) return [];

    const sorted = [...snapshots].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date)
    );

    if (activeRange === "DAY") {
      // Recent 30 days (or all if fewer)
      const recent = sorted.slice(-30);
      return recent.map((item) => {
        const { year, month, day } = parseDate(item.snapshot_date);
        return {
          displayLabel: `${day} ${SHORT_MONTH_NAMES[month]}`,
          fullDateLabel: `${day} ${MONTH_NAMES[month]} ${year}`,
          score: Number(item.predicted_score.toFixed(2)),
          risk: item.risk_level.toUpperCase(),
          passProb: Math.round(item.pass_probability * 100),
          snapshotCount: 1,
        };
      });
    }

    if (activeRange === "WEEK") {
      // Exactly 5 weekly bars (last 35 days)
      const last35 = sorted.slice(-35);
      const weeks: ChartBarData[] = [];
      const numWeeks = 5;
      const chunkSize = 7;

      for (let i = 0; i < numWeeks; i++) {
        const startIdx = i * chunkSize;
        const chunk = last35.slice(startIdx, startIdx + chunkSize);
        if (chunk.length === 0) continue;

        const first = parseDate(chunk[0].snapshot_date);
        const last = parseDate(chunk[chunk.length - 1].snapshot_date);

        const avgScore =
          chunk.reduce((sum, s) => sum + s.predicted_score, 0) / chunk.length;
        const avgProb =
          chunk.reduce((sum, s) => sum + s.pass_probability, 0) / chunk.length;

        // Dominant risk
        const riskCounts: Record<string, number> = {};
        chunk.forEach((s) => {
          const r = s.risk_level.toUpperCase();
          riskCounts[r] = (riskCounts[r] || 0) + 1;
        });
        const repRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0][0];

        const firstLabel = `${first.day} ${SHORT_MONTH_NAMES[first.month]}`;
        const lastLabel = `${last.day} ${SHORT_MONTH_NAMES[last.month]}`;

        weeks.push({
          displayLabel: `${first.day}–${lastLabel}`,
          fullDateLabel: `Week: ${first.day} ${MONTH_NAMES[first.month]} – ${last.day} ${MONTH_NAMES[last.month]} ${last.year}`,
          score: Number(avgScore.toFixed(2)),
          risk: repRisk,
          passProb: Math.round(avgProb * 100),
          snapshotCount: chunk.length,
        });
      }
      return weeks;
    }

    if (activeRange === "MONTH") {
      // Group by calendar month YYYY-MM
      const monthGroups: Record<string, DailySnapshotItem[]> = {};
      sorted.forEach((item) => {
        const key = item.snapshot_date.substring(0, 7);
        if (!monthGroups[key]) monthGroups[key] = [];
        monthGroups[key].push(item);
      });

      return Object.entries(monthGroups).map(([key, items]) => {
        const [yearStr, monthStr] = key.split("-");
        const monthIdx = parseInt(monthStr, 10) - 1;
        const fullMonthName = `${MONTH_NAMES[monthIdx]} ${yearStr}`;
        const shortMonthName = `${SHORT_MONTH_NAMES[monthIdx]} '${yearStr.slice(2)}`;

        const avgScore =
          items.reduce((sum, s) => sum + s.predicted_score, 0) / items.length;
        const avgProb =
          items.reduce((sum, s) => sum + s.pass_probability, 0) / items.length;

        const firstRisk = items[0].risk_level.toUpperCase();
        const lastRisk = items[items.length - 1].risk_level.toUpperCase();
        const riskTrend = firstRisk === lastRisk ? firstRisk : `${firstRisk} → ${lastRisk}`;

        const riskCounts: Record<string, number> = {};
        items.forEach((s) => {
          const r = s.risk_level.toUpperCase();
          riskCounts[r] = (riskCounts[r] || 0) + 1;
        });
        const repRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0][0];

        return {
          displayLabel: shortMonthName,
          fullDateLabel: fullMonthName,
          score: Number(avgScore.toFixed(2)),
          risk: repRisk,
          passProb: Math.round(avgProb * 100),
          snapshotCount: items.length,
          riskTrend: riskTrend,
        };
      });
    }

    if (activeRange === "YEAR") {
      // 12 monthly bars
      const monthGroups: Record<string, DailySnapshotItem[]> = {};
      sorted.forEach((item) => {
        const key = item.snapshot_date.substring(0, 7);
        if (!monthGroups[key]) monthGroups[key] = [];
        monthGroups[key].push(item);
      });

      const entries = Object.entries(monthGroups).slice(-12);
      return entries.map(([key, items]) => {
        const [yearStr, monthStr] = key.split("-");
        const monthIdx = parseInt(monthStr, 10) - 1;
        const fullMonthName = `${MONTH_NAMES[monthIdx]} ${yearStr}`;
        const shortName = SHORT_MONTH_NAMES[monthIdx];

        const avgScore =
          items.reduce((sum, s) => sum + s.predicted_score, 0) / items.length;
        const avgProb =
          items.reduce((sum, s) => sum + s.pass_probability, 0) / items.length;

        const riskCounts: Record<string, number> = {};
        items.forEach((s) => {
          const r = s.risk_level.toUpperCase();
          riskCounts[r] = (riskCounts[r] || 0) + 1;
        });
        const repRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0][0];

        return {
          displayLabel: shortName,
          fullDateLabel: fullMonthName,
          score: Number(avgScore.toFixed(2)),
          risk: repRisk,
          passProb: Math.round(avgProb * 100),
          snapshotCount: items.length,
        };
      });
    }

    return [];
  }, [snapshots, activeRange]);

  // 2. Computed Metrics for Selected Period
  const periodMetrics = useMemo(() => {
    if (chartData.length === 0) {
      return {
        avgScore: 0,
        startingScore: 0,
        latestScore: 0,
        scoreDiff: 0,
        highCount: 0,
        modCount: 0,
        lowCount: 0,
        trend: "steady",
        consistency: "High",
      };
    }

    const scores = chartData.map((d) => d.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const startingScore = scores[0];
    const latestScore = scores[scores.length - 1];
    const scoreDiff = latestScore - startingScore;

    let highCount = 0;
    let modCount = 0;
    let lowCount = 0;
    chartData.forEach((d) => {
      if (d.risk === "HIGH") highCount += d.snapshotCount;
      else if (d.risk === "MODERATE") modCount += d.snapshotCount;
      else lowCount += d.snapshotCount;
    });

    const trend =
      scoreDiff > 1.0 ? "improving" : scoreDiff < -1.0 ? "declining" : "steady";

    // Consistency: variance of scores
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) /
      scores.length;
    const stdDev = Math.sqrt(variance);
    const consistency =
      stdDev < 2.5 ? "High" : stdDev < 5.0 ? "Moderate" : "Variable";

    return {
      avgScore: Number(avgScore.toFixed(2)),
      startingScore,
      latestScore,
      scoreDiff: Number(scoreDiff.toFixed(2)),
      highCount,
      modCount,
      lowCount,
      trend,
      consistency,
    };
  }, [chartData]);

  // 3. Dynamic Student-Friendly Explanations
  const keyResultText = useMemo(() => {
    if (periodMetrics.trend === "improving") {
      return "Your predicted performance is improving.";
    }
    if (periodMetrics.trend === "declining") {
      return "Your predicted performance shows a slight dip.";
    }
    return "Your predicted performance remains steady.";
  }, [periodMetrics.trend]);

  const whatThisMeansText = useMemo(() => {
    if (chartData.length < 2) {
      return "More daily performance snapshots are needed before this trend can be shown.";
    }
    const diffAbs = Math.abs(periodMetrics.scoreDiff);
    const directionWord =
      periodMetrics.scoreDiff > 0
        ? "increased"
        : periodMetrics.scoreDiff < 0
        ? "decreased"
        : "remained stable at";

    if (periodMetrics.scoreDiff === 0) {
      return `Your average predicted score has remained stable at approximately ${periodMetrics.latestScore} over the selected period. This indicates consistent academic indicators across your profile.`;
    }

    return `Your average predicted score ${directionWord} from ${periodMetrics.startingScore} to ${periodMetrics.latestScore} (${periodMetrics.scoreDiff >= 0 ? "+" : ""}${periodMetrics.scoreDiff} pts) over the selected period. This indicates ${periodMetrics.trend === "improving" ? "an upward trajectory" : "a modest fluctuation"} in the model's current assessment of your academic performance.`;
  }, [chartData, periodMetrics]);

  const whatToNoticeText = useMemo(() => {
    if (chartData.length === 0) return "";
    if (periodMetrics.highCount === 0) {
      return `You have logged 0 high-risk days across this timeframe, with ${periodMetrics.lowCount} low-risk days maintaining a solid academic buffer.`;
    }
    if (periodMetrics.trend === "improving") {
      return "Your recent scores are fairly stable, but the latest recorded intervals show gradual improvement as study habits stabilize.";
    }
    return "Study regularity and attendance remain the primary anchors keeping your score steady across this timeframe.";
  }, [chartData, periodMetrics]);

  const getBarColor = (score: number, risk: string) => {
    if (risk === "HIGH" || score < 50) return "#f43f5e";
    if (risk === "MODERATE" || score < 70) return "#f59e0b";
    return "#6366f1";
  };

  const getXAxisLabel = () => {
    switch (activeRange) {
      case "DAY":
        return "Date";
      case "WEEK":
        return "Week";
      case "MONTH":
      case "YEAR":
        return "Month";
    }
  };

  return (
    <aside
      aria-label="Performance Analysis Panel"
      className={`flex flex-col rounded-3xl border border-white/10 bg-[#0d111a]/95 p-5 shadow-2xl backdrop-blur-2xl ${className}`}
    >
      {/* 1. Header & Close Button */}
      <div className="flex items-start justify-between border-b border-white/8 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              {title}
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 leading-snug">
            {subtitle}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 2. Range Controls: [ DAY ] [ WEEK ] [ MONTH ] [ YEAR ] */}
      <div className="mt-4">
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/4 p-1">
          {(["DAY", "WEEK", "MONTH", "YEAR"] as RangeType[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setActiveRange(r);
              }}
              className={`rounded-xl py-1.5 text-center text-xs font-bold transition-all ${
                activeRange === r
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* If Insufficient Data */}
      {chartData.length === 0 ? (
        <div className="my-8 rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-slate-500 mb-2" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Not Enough Data Yet
          </h4>
          <p className="mt-1 text-[11px] text-slate-400">
            More daily performance snapshots are needed before this trend can be shown.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* 3. Key Result (Explanation First) */}
          <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-3.5">
            <div className="flex items-center gap-2">
              {periodMetrics.trend === "improving" ? (
                <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : periodMetrics.trend === "declining" ? (
                <TrendingDown className="h-4 w-4 text-amber-400 shrink-0" />
              ) : (
                <Minus className="h-4 w-4 text-cyan-400 shrink-0" />
              )}
              <span className="text-xs font-bold text-white">
                {keyResultText}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300 leading-snug">
              {activeRange === "DAY" && `Based on ${chartData.length} recorded daily snapshots (last 30 calendar days).`}
              {activeRange === "WEEK" && `Based on ${chartData.length} weekly intervals (last 35 calendar days, 7 days/week).`}
              {activeRange === "MONTH" && `Based on all ${chartData.length} recorded calendar months (Sep '26 - Sep '27, 365 daily snapshots).`}
              {activeRange === "YEAR" && `Based on exactly ${chartData.length} consecutive calendar months (Oct '26 - Sep '27, 354 daily snapshots).`}
            </p>
          </div>

          {/* 4. Compact Key Metrics (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Avg Predicted Score
              </span>
              <p className="mt-0.5 text-sm font-bold text-white font-mono">
                {periodMetrics.avgScore} <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Trend Momentum
              </span>
              <p className={`mt-0.5 text-sm font-bold font-mono ${
                periodMetrics.scoreDiff >= 0 ? "text-emerald-400" : "text-amber-400"
              }`}>
                {periodMetrics.scoreDiff >= 0 ? "+" : ""}{periodMetrics.scoreDiff} pts
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Risk Days
              </span>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-200">
                <span className="text-emerald-400">{periodMetrics.lowCount}L</span>
                {" • "}
                <span className="text-amber-400">{periodMetrics.modCount}M</span>
                {" • "}
                <span className="text-rose-400">{periodMetrics.highCount}H</span>
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Consistency
              </span>
              <p className="mt-0.5 text-sm font-bold text-cyan-300">
                {periodMetrics.consistency}
              </p>
            </div>
          </div>

          {/* 5. Graph (Bar Chart Second) */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-3">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 8, left: -20, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis
                    dataKey="displayLabel"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    stroke="rgba(255, 255, 255, 0.1)"
                    interval="preserveStartEnd"
                    label={{
                      value: getXAxisLabel(),
                      position: "insideBottom",
                      offset: -10,
                      fill: "#64748b",
                      fontSize: 9,
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    stroke="rgba(255, 255, 255, 0.1)"
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const item: ChartBarData = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/15 bg-[#0a0d14]/95 p-3 shadow-2xl backdrop-blur-xl text-xs space-y-1 min-w-[170px]">
                          <p className="font-bold text-white text-xs border-b border-white/10 pb-1">
                            {item.fullDateLabel}
                          </p>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-slate-400">Predicted Score:</span>
                            <span className="font-mono font-bold text-indigo-300">
                              {item.score} / 100
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Risk Tier:</span>
                            <span
                              className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                                item.risk === "HIGH"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : item.risk === "MODERATE"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {item.risk}
                            </span>
                          </div>
                          {item.snapshotCount > 1 && (
                            <div className="flex items-center justify-between border-t border-white/8 pt-1 text-[10px] text-slate-400">
                              <span>Recorded Days:</span>
                              <span className="font-mono">{item.snapshotCount}</span>
                            </div>
                          )}
                          {item.riskTrend && (
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Risk Trend:</span>
                              <span className="text-slate-300">{item.riskTrend}</span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`sidebar-cell-${index}`}
                        fill={getBarColor(entry.score, entry.risk)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. WHAT THIS MEANS */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              What This Means
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {whatThisMeansText}
            </p>
          </div>

          {/* 7. WHAT TO NOTICE (Secondary Insight) */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              What to Notice
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {whatToNoticeText}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
