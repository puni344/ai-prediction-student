import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { Card } from "../../components/common/Card";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { AIIntelligenceBanner } from "../../components/ui/AIIntelligenceBanner";
import { facultyService } from "../../services/api";
import { FacultyAnalyticsResponse } from "../../types";
import { BarChart3, TrendingUp, ShieldAlert, Award, Compass } from "lucide-react";

// Correlations are computed authoritatively by backend scipy/numpy statistics

export const FacultyAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<FacultyAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await facultyService.getAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load departmental analytics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return <LoadingState message="Computing departmental performance correlations..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Analytics Error"
        message={error || "Failed to load cohort analytics."}
        onRetry={fetchAnalytics}
      />
    );
  }

  if (data.total_predictions === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Departmental Analytics</h1>
          <p className="mt-1 text-xs text-slate-400">
            Cross-correlate attendance, study hours, and assignment completion against exam score outcomes.
          </p>
        </div>
        <EmptyState
          title="No Cohort Analytics Recorded"
          description="Analytics charts require stored prediction records. When students perform simulations, aggregate distribution charts will render here automatically."
          icon={BarChart3}
        />
      </div>
    );
  }

  const scoreDistData = Object.entries(data.score_distribution).map(([range, count]) => ({
    range,
    count,
  }));

  const rAttendance = data?.correlations?.attendance ?? null;
  const rStudy = data?.correlations?.study_hours ?? null;
  const rAssignments = data?.correlations?.assignments ?? null;

  const riskDistData = [
    { name: "Low Risk", count: data.risk_distribution.LOW, color: "#10b981" },
    { name: "Moderate Risk", count: data.risk_distribution.MODERATE, color: "#f59e0b" },
    { name: "High Risk", count: data.risk_distribution.HIGH, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Departmental Analytics</h1>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
            Cohort Statistical Lens
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Empirical statistical correlations computed directly from stored evaluation records.
        </p>
      </div>

      {/* Telemetry Command Strip */}
      <div className="rounded-2xl border border-white/8 bg-[#0d111a]/90 backdrop-blur-xl shadow-2xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
          <div className="px-5 py-2 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Total Evaluated</span>
              <Award className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-white font-mono">
              <AnimatedNumber value={data.total_predictions} decimals={0} />
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Records aggregated for analytics
            </div>
          </div>

          <div className="px-5 py-2 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Cohort Mean Score</span>
              <TrendingUp className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                <AnimatedNumber value={data.average_predicted_score ?? 0} />
              </span>
              <span className="text-lg font-bold text-slate-400">%</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Average predicted final grade
            </div>
          </div>

          <div className="px-5 py-2 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Pass Probability</span>
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                <AnimatedNumber value={Math.round((data.average_pass_probability ?? 0) * 1000) / 10} />
              </span>
              <span className="text-lg font-bold text-slate-400">%</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Mean likelihood of passing
            </div>
          </div>
        </div>
      </div>

      {/* Distributions Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Score Distribution */}
        <Card className="border-white/8 shadow-2xl backdrop-blur-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3">
            Predicted Score Distribution
          </h3>
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0e121b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                  formatter={(val: any) => [`${val} students`, "Count"]}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Risk Distribution */}
        <Card className="border-white/8 shadow-2xl backdrop-blur-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3">
            Risk Tier Classification
          </h3>
          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0e121b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                  formatter={(val: any) => [`${val} students`, "Count"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Scatter Correlations */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance vs Score */}
        <Card className="border-white/8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Attendance vs Score
            </h3>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              {rAttendance !== null ? `r = ${rAttendance >= 0 ? "+" : ""}${rAttendance.toFixed(2)}` : "r = N/A"}
            </span>
          </div>
          <div className="h-60 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" dataKey="x" name="Attendance" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                <YAxis type="number" dataKey="y" name="Score" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" domain={[0, 100]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ backgroundColor: "#0e121b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                />
                <Scatter name="Students" data={data.attendance_vs_score} fill="#06b6d4" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Study Hours vs Score */}
        <Card className="border-white/8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Study Hours vs Score
            </h3>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
              {rStudy !== null ? `r = ${rStudy >= 0 ? "+" : ""}${rStudy.toFixed(2)}` : "r = N/A"}
            </span>
          </div>
          <div className="h-60 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" dataKey="x" name="Study Hours" unit="h" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                <YAxis type="number" dataKey="y" name="Score" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" domain={[0, 100]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ backgroundColor: "#0e121b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                />
                <Scatter name="Students" data={data.study_hours_vs_score} fill="#6366f1" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Assignments vs Score */}
        <Card className="border-white/8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Assignments vs Score
            </h3>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              {rAssignments !== null ? `r = ${rAssignments >= 0 ? "+" : ""}${rAssignments.toFixed(2)}` : "r = N/A"}
            </span>
          </div>
          <div className="h-60 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" dataKey="x" name="Assignments" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                <YAxis type="number" dataKey="y" name="Score" unit="%" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" domain={[0, 100]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ backgroundColor: "#0e121b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                />
                <Scatter name="Students" data={data.assignments_vs_score} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
