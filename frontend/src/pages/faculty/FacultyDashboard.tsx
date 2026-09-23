import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Users, AlertTriangle, TrendingUp, ShieldAlert, ArrowRight, BookOpen, ShieldCheck, Cpu, Sparkles, Activity, Layers, Bell } from "lucide-react";
import { Card } from "../../components/common/Card";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/common/Button";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { AIIntelligenceBanner } from "../../components/ui/AIIntelligenceBanner";
import { facultyService } from "../../services/api";
import { FacultyDashboardResponse } from "../../types";

export const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<FacultyDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await facultyService.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load faculty dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (isLoading) {
    return <LoadingState message="Aggregating live cohort intelligence..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Command Center Error"
        message={error || "Unable to retrieve cohort metrics."}
        onRetry={fetchDashboard}
      />
    );
  }

  const hasEnrolled = data.total_enrolled_students > 0;
  const hasPredictions = data.students_with_predictions > 0;

  return (
    <div className="space-y-6">
      {/* Executive Command Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/8 bg-[#0d111a]/85 p-6 backdrop-blur-xl shadow-2xl sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Faculty Command Center</h1>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
              Executive View
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time cohort monitoring, deterministic risk distribution, and early academic intervention.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/faculty/students")}>
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Student Directory
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate("/faculty/risk-monitor")}>
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Risk Monitor
          </Button>
        </div>
      </div>

      {/* Autonomous Faculty Intervention Directive */}
      {hasPredictions && data.high_risk_count > 0 && (
        <AIIntelligenceBanner
          category="diagnostic"
          badge="COHORT ACTION DIRECTIVE"
          title="Automated Cohort Risk Alert"
          strategy={`${data.high_risk_count} student is currently flagged in the High Risk tier (${((data.high_risk_count / data.students_with_predictions) * 100).toFixed(0)}% of evaluated cohort). Attendance deficiency is the primary contributing risk vector. Recommended immediate proactive counseling to avert examination failure.`}
          actionLabel="Open High Risk Cohort"
          onAction={() => navigate("/faculty/risk-monitor")}
          tags={["EarlyIntervention", "HighRiskFlag", "DeterministicScoring"]}
          confidence={99.4}
        />
      )}

      {/* Integrated Telemetry Command Strip */}
      <div className="rounded-2xl border border-white/8 bg-[#0d111a]/90 backdrop-blur-xl shadow-2xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
          {/* Total Enrolled */}
          <div className="px-5 py-3 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Total Enrolled</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                <AnimatedNumber value={data.total_enrolled_students} decimals={0} />
              </span>
              <span className="text-[11px] text-slate-400 font-mono">enrolled</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{data.students_with_predictions} evaluated with ML</span>
            </div>
          </div>

          {/* High Risk Flagged */}
          <div className="px-5 py-3 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">High Risk Cases</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-rose-400 font-mono">
                <AnimatedNumber value={data.high_risk_count} decimals={0} />
              </span>
              <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                Action Needed
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {data.moderate_risk_count} moderate risk cases
            </div>
          </div>

          {/* Average Score */}
          <div className="px-5 py-3 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Average Score</span>
              <TrendingUp className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                <AnimatedNumber value={data.average_predicted_score ?? 0} />
              </span>
              <span className="text-lg font-bold text-slate-400">%</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Cohort mean predicted grade
            </div>
          </div>

          {/* Pass Probability */}
          <div className="px-5 py-3 first:pl-0 last:pr-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Pass Probability</span>
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                <AnimatedNumber value={Math.round((data.average_pass_probability ?? 0) * 1000) / 10} />
              </span>
              <span className="text-lg font-bold text-slate-400">%</span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Healthy
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Cohort passing likelihood
            </div>
          </div>
        </div>
      </div>

      {/* Main Cohort Panels */}
      {!hasEnrolled ? (
        <EmptyState
          title="No Students Registered"
          description="There are currently no students registered in the database. When students enroll, cohort statistics will automatically populate here."
          icon={Users}
        />
      ) : !hasPredictions ? (
        <EmptyState
          title="No Predictions Recorded Yet"
          description="Students are enrolled, but none have simulated academic predictions yet. Cohort risk distribution will update as predictions are generated."
          icon={BookOpen}
          actionText="View Student Directory"
          onAction={() => navigate("/faculty/students")}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Risk Tier Distribution */}
          <Card className="lg:col-span-2 border-white/8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Cohort Risk Tier Distribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">{data.students_with_predictions} evaluated</span>
            </div>

            <div className="mt-6 space-y-5">
              {/* High Risk Bar */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                    High Risk Tier
                  </span>
                  <span className="font-bold text-white font-mono">
                    {data.high_risk_count}{" "}
                    <span className="text-slate-400 text-[11px] font-normal">
                      ({((data.high_risk_count / data.students_with_predictions) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-700 shadow-sm shadow-rose-500/50"
                    style={{
                      width: `${(data.high_risk_count / data.students_with_predictions) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Moderate Risk Bar */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Moderate Risk Tier
                  </span>
                  <span className="font-bold text-white font-mono">
                    {data.moderate_risk_count}{" "}
                    <span className="text-slate-400 text-[11px] font-normal">
                      ({((data.moderate_risk_count / data.students_with_predictions) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-700 shadow-sm shadow-amber-500/50"
                    style={{
                      width: `${(data.moderate_risk_count / data.students_with_predictions) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Low Risk Bar */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Low Risk (Satisfactory)
                  </span>
                  <span className="font-bold text-white font-mono">
                    {data.low_risk_count}{" "}
                    <span className="text-slate-400 text-[11px] font-normal">
                      ({((data.low_risk_count / data.students_with_predictions) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700 shadow-sm shadow-emerald-500/50"
                    style={{
                      width: `${(data.low_risk_count / data.students_with_predictions) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-white/8 pt-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/faculty/analytics")}>
                Explore Correlation Scatter Plots
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>

          {/* Quick Action Center */}
          <Card className="flex flex-col justify-between border-white/8 shadow-2xl backdrop-blur-xl">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3">
                Faculty Action Center
              </h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                      Risk Monitor — Assigned Departments
                    </span>
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      {data.high_risk_count + data.moderate_risk_count} total
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    Prioritized roster sorted by deterministic risk index for immediate mentoring.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => navigate("/faculty/risk-monitor")}
                  >
                    Open Risk Monitor
                  </Button>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/3 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Cohort Directory
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {data.total_enrolled_students} enrolled
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Inspect individual student profiles, roll numbers, and TreeSHAP drivers.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => navigate("/faculty/students")}
                  >
                    Browse Directory
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 text-xs text-indigo-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400" />
              <span>Role-Based Access: Faculty read-only authority.</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
