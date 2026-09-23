import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { SHAPContributor } from "../../types";

interface SHAPChartProps {
  positive: SHAPContributor[];
  negative: SHAPContributor[];
  baseValue?: number;
}

export const SHAPChart: React.FC<SHAPChartProps> = ({ positive, negative, baseValue }) => {
  const combined = [
    ...positive.map((p) => ({ ...p, type: "positive" as const })),
    ...negative.map((n) => ({ ...n, type: "negative" as const })),
  ].sort((a, b) => a.contribution - b.contribution);

  if (combined.length === 0) {
    return <p className="text-sm text-slate-400">No SHAP contributors available for this record.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-b border-white/8 pb-2.5">
        <span>
          Population Baseline: <strong className="text-white">{baseValue !== undefined ? `${baseValue.toFixed(2)}%` : "—"}</strong>
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400" /> Positive (Boosts Score)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-400 shadow-xs shadow-rose-400" /> Negative (Drags Score)
          </span>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={combined} layout="vertical" margin={{ top: 5, right: 20, left: 90, bottom: 5 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
              tickLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
            />
            <YAxis
              dataKey="feature"
              type="category"
              tick={{ fontSize: 11, fill: "#cbd5e1" }}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
              tickLine={false}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null;
                const item = payload[0].payload;
                const isPos = item.contribution >= 0;
                return (
                  <div className="rounded-xl border border-white/12 bg-[#0e121b]/95 p-2.5 shadow-2xl backdrop-blur-xl text-xs">
                    <p className="font-bold text-white mb-1">{item.feature}</p>
                    <p className={isPos ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                      Impact: {isPos ? "+" : ""}{Number(item.contribution).toFixed(3)} pts
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {isPos ? "Positively influencing trajectory" : "Vulnerability pulling score down"}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="3 3" />
            <Bar dataKey="contribution" radius={[4, 4, 4, 4]}>
              {combined.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.contribution >= 0 ? "#10b981" : "#f43f5e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
