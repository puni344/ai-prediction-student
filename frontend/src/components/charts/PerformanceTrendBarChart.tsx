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
import { BarChart3 } from "lucide-react";

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

interface PerformanceTrendBarChartProps {
  snapshots: DailySnapshotItem[];
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
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const PerformanceTrendBarChart: React.FC<PerformanceTrendBarChartProps> = ({
  snapshots,
  className = "",
}) => {
  const [activeRange, setActiveRange] = useState<RangeType>("DAY");

  // Format date helper: parses YYYY-MM-DD safely in local calendar
  const parseDate = (dateStr: string): { year: number; month: number; day: number } => {
    const parts = dateStr.split("-");
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1, // 0-indexed
      day: parseInt(parts[2], 10),
    };
  };

  const chartData = useMemo<ChartBarData[]>(() => {
    if (!snapshots || snapshots.length === 0) return [];

    // Sort chronologically ascending
    const sorted = [...snapshots].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date)
    );

    if (activeRange === "DAY") {
      // Show readable recent daily range (last 14 days)
      const recent = sorted.slice(-14);
      return recent.map((item) => {
        const { year, month, day } = parseDate(item.snapshot_date);
        const shortMonth = SHORT_MONTH_NAMES[month];
        const fullMonth = MONTH_NAMES[month];
        return {
          displayLabel: `${day} ${shortMonth}`,
          fullDateLabel: `${day} ${fullMonth} ${year}`,
          score: Number(item.predicted_score.toFixed(2)),
          risk: item.risk_level.toUpperCase(),
          passProb: Math.round(item.pass_probability * 100),
          snapshotCount: 1,
        };
      });
    }

    if (activeRange === "WEEK") {
      // Exactly 5 weeks (35 days from the end of the timeline)
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

        // Representative risk: most frequent in the week
        const riskCounts: Record<string, number> = {};
        chunk.forEach((s) => {
          const r = s.risk_level.toUpperCase();
          riskCounts[r] = (riskCounts[r] || 0) + 1;
        });
        const repRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0][0];

        const firstLabel = `${first.day} ${SHORT_MONTH_NAMES[first.month]}`;
        const lastLabel = `${last.day} ${SHORT_MONTH_NAMES[last.month]}`;

        weeks.push({
          displayLabel: `W${i + 1} · ${first.day}–${lastLabel}`,
          fullDateLabel: `Week ${i + 1} (${firstLabel} – ${lastLabel} ${last.year})`,
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
        const key = item.snapshot_date.substring(0, 7); // YYYY-MM
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
        };
      });
    }

    if (activeRange === "YEAR") {
      // 12 monthly buckets across the yearly dataset
      const monthGroups: Record<string, DailySnapshotItem[]> = {};
      sorted.forEach((item) => {
        const key = item.snapshot_date.substring(0, 7);
        if (!monthGroups[key]) monthGroups[key] = [];
        monthGroups[key].push(item);
      });

      // Keep up to 12 months
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

  const getTitle = () => {
    switch (activeRange) {
      case "DAY":
        return "Predicted Performance — Daily Snapshots";
      case "WEEK":
        return "Predicted Performance — Last 5 Weeks";
      case "MONTH":
        return "Predicted Performance — Monthly Progression";
      case "YEAR":
        return "Predicted Performance — Full Year Progression";
    }
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

  const getYAxisLabel = () => {
    return activeRange === "DAY" ? "Predicted Score" : "Average Predicted Score";
  };

  const getBarColor = (score: number, risk: string) => {
    if (risk === "HIGH" || score < 50) return "#f43f5e"; // rose-500
    if (risk === "MODERATE" || score < 70) return "#f59e0b"; // amber-500
    return "#6366f1"; // indigo-500
  };

  return (
    <div className={`rounded-3xl border border-white/10 bg-[#0d111a]/90 p-6 shadow-2xl backdrop-blur-xl ${className}`}>
      {/* Header & Range Selector Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {getTitle()}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative official daily snapshots aggregated mathematically in Asia/Kolkata timezone
          </p>
        </div>

        {/* 4 Explicit Range Buttons */}
        <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/4 p-1">
          {(["DAY", "WEEK", "MONTH", "YEAR"] as RangeType[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setActiveRange(r);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeRange === r
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Bar Chart Canvas */}
      <div className="mt-6 h-72 w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -5, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                stroke="rgba(255, 255, 255, 0.1)"
                label={{
                  value: getXAxisLabel(),
                  position: "insideBottom",
                  offset: -15,
                  fill: "#64748b",
                  fontSize: 11,
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                stroke="rgba(255, 255, 255, 0.1)"
                label={{
                  value: getYAxisLabel(),
                  angle: -90,
                  position: "insideLeft",
                  offset: 15,
                  fill: "#64748b",
                  fontSize: 11,
                }}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const item: ChartBarData = payload[0].payload;
                  return (
                    <div className="rounded-2xl border border-white/15 bg-[#0a0d14]/95 p-4 shadow-2xl backdrop-blur-xl text-xs space-y-1.5 min-w-[190px]">
                      <p className="font-bold text-white text-sm border-b border-white/10 pb-1">
                        {item.fullDateLabel}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400">Predicted Performance:</span>
                        <span className="font-mono font-bold text-indigo-300 text-sm">
                          {item.score} / 100
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Academic Risk:</span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
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
                      {item.passProb !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Pass Probability:</span>
                          <span className="text-slate-200 font-mono">{item.passProb}%</span>
                        </div>
                      )}
                      {item.snapshotCount > 1 && (
                        <div className="flex items-center justify-between border-t border-white/8 pt-1 text-[11px] text-slate-400">
                          <span>Source Snapshots:</span>
                          <span className="font-mono">{item.snapshotCount} days</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry.score, entry.risk)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No snapshot data available to chart.
          </div>
        )}
      </div>
    </div>
  );
};
