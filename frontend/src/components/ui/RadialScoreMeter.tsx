import React from "react";
import { AnimatedNumber } from "./AnimatedNumber";

interface RadialScoreMeterProps {
  score: number; // 0 - 100
  passProbability: number; // 0 - 1
  riskLevel: string;
  size?: number;
}

export const RadialScoreMeter: React.FC<RadialScoreMeterProps> = ({
  score,
  passProbability,
  riskLevel,
  size = 190,
}) => {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Inner confidence ring
  const innerStrokeWidth = 4;
  const innerRadius = radius - 16;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const innerOffset = innerCircumference - (passProbability * innerCircumference);

  const upperRisk = riskLevel.toUpperCase();
  const colorMap = {
    LOW: { stroke: "#10b981", glow: "rgba(16, 185, 129, 0.5)", text: "text-emerald-400", bg: "bg-emerald-500/10" },
    MODERATE: { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.5)", text: "text-amber-400", bg: "bg-amber-500/10" },
    HIGH: { stroke: "#f43f5e", glow: "rgba(244, 63, 94, 0.5)", text: "text-rose-400", bg: "bg-rose-500/10" },
  }[upperRisk] || { stroke: "#6366f1", glow: "rgba(99, 102, 241, 0.5)", text: "text-indigo-400", bg: "bg-indigo-500/10" };

  return (
    <div className="relative flex flex-col items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        {/* Outer Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.07)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Inner Confidence Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={innerStrokeWidth}
          fill="transparent"
        />

        {/* Inner Confidence Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          stroke="#06b6d4"
          strokeWidth={innerStrokeWidth}
          strokeDasharray={innerCircumference}
          strokeDashoffset={innerOffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
            opacity: 0.8,
          }}
        />

        {/* Primary Animated Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorMap.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 10px ${colorMap.glow})`,
          }}
        />
      </svg>

      {/* Center Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          <AnimatedNumber value={score} decimals={1} />
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
          Out of 100
        </span>
        <span className={`mt-1.5 text-[11px] font-bold ${colorMap.text} ${colorMap.bg} px-2 py-0.5 rounded-full border border-current/20`}>
          {(passProbability * 100).toFixed(0)}% pass prob
        </span>
      </div>
    </div>
  );
};
