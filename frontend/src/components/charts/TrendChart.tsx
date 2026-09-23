import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PredictionResponse } from "../../types";

export const TrendChart: React.FC<{ data: PredictionResponse[] }> = ({ data }) => {
  const chartData = [...data].reverse().map((item, idx) => ({
    name: item.created_at ? new Date(item.created_at).toLocaleDateString() : `Sim #${idx + 1}`,
    score: item.predicted_score,
    passProb: Math.round(item.pass_probability * 100),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            stroke="rgba(255, 255, 255, 0.1)"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            stroke="rgba(255, 255, 255, 0.1)"
          />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload || !payload.length) return null;
              const pt = payload[0].payload;
              return (
                <div className="rounded-xl border border-white/12 bg-[#0e121b]/95 p-3 shadow-2xl backdrop-blur-xl text-xs">
                  <p className="font-semibold text-slate-300 mb-1">{label}</p>
                  <p className="text-indigo-400 font-bold text-sm">Predicted Score: {pt.score}%</p>
                  <p className="text-slate-400 mt-0.5">Pass Likelihood: {pt.passProb}%</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#scoreGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
