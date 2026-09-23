import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Sparkles,
  BarChart3,
  UserCheck,
  Target,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { predictionService, studentService, systemService, calendarService } from "../../services/api";
import { PredictionResponse, StudentProfile, DayResolutionResponse } from "../../types";
import { getProgramByNameOrId } from "../../constants/programs";
import { Button } from "../../components/common/Button";
import { RadialScoreMeter } from "../../components/ui/RadialScoreMeter";
import { RiskBadge } from "../../components/common/RiskBadge";
import { SHAPChart } from "../../components/charts/SHAPChart";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { AcademicCalendarWidget } from "./AcademicCalendarWidget";

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<PredictionResponse[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [systemClock, setSystemClock] = useState<{
    local_date: string;
    local_time: string;
    day_of_week: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dayStatus, setDayStatus] = useState<DayResolutionResponse | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [histData, profData, clockData] = await Promise.all([
          predictionService.getHistory(),
          studentService.getProfile(),
          systemService.getNow().catch(() => null),
        ]);
        setHistory(histData);
        setProfile(profData);
        if (clockData) setSystemClock(clockData);
      } catch (err) {
        console.error("Failed to load student dashboard intelligence", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    try {
      setIsCalendarLoading(true);
      const cal = await calendarService.getDayStatus(newDate);
      setDayStatus(cal);
    } catch (err) {
      console.warn("Failed to load day status for date:", newDate, err);
    } finally {
      setIsCalendarLoading(false);
    }
  };

  // Redirect to complete-profile if academic identity is missing
  React.useEffect(() => {
    if (!isLoading && profile !== null) {
      const isIncomplete = !profile?.program || !profile?.academic_year || !profile?.department;
      if (isIncomplete) {
        navigate("/student/complete-profile", { replace: true });
      }
    }
  }, [isLoading, profile, navigate]);

  if (isLoading) {
    return <LoadingState message="Aggregating academic intelligence..." />;
  }

  const latest = history.length > 0 ? history[0] : null;
  const isProfileIncomplete = !profile?.program || !profile?.academic_year || !profile?.department;
  const programDisplayName = profile?.program ? (getProgramByNameOrId(profile.program)?.name || profile.program) : null;

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner with Student Identifier */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/8 bg-[#0d111a]/85 p-6 backdrop-blur-xl shadow-2xl sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {user?.full_name}
            </h1>
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              Student Lab
            </span>
          </div>

          {isProfileIncomplete ? (
            <p className="mt-1 text-xs text-amber-400 font-medium">
              Academic profile incomplete - <Link to="/student/complete-profile" className="underline hover:text-amber-300">Complete Profile</Link>
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              {programDisplayName} - {profile.department} - {profile.academic_year} - Roll: {profile.roll_number || "Not Assigned"}
            </p>
          )}

          {systemClock && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Today: {systemClock.day_of_week}, {systemClock.local_date} (Asia/Kolkata)
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/student/performance-analysis">
            <Button
              variant="outline"
              size="md"
              className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
            >
              <BarChart3 className="mr-2 h-4 w-4 text-indigo-400" />
              Performance Analysis
            </Button>
          </Link>
          <Link to="/student/prediction">
            <Button variant="primary" size="md">
              <Activity className="mr-2 h-4 w-4" /> Run New Simulation
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Access Actions Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/student/prediction"
          className="group rounded-2xl border border-white/8 bg-[#0d111a]/80 p-4 hover:border-indigo-500/40 hover:bg-[#0d111a] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Activity className="h-4.5 w-4.5" />
            </span>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-white">
            Performance Simulation
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Run ML models with TreeSHAP attributions
          </p>
        </Link>

        <Link
          to="/student/timetable"
          className="group rounded-2xl border border-white/8 bg-[#0d111a]/80 p-4 hover:border-cyan-500/40 hover:bg-[#0d111a] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Calendar className="h-4.5 w-4.5" />
            </span>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-white">
            Study Timetable
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Smart daily routine and study planner
          </p>
        </Link>

        <Link
          to="/student/ai-advisor"
          className="group rounded-2xl border border-white/8 bg-[#0d111a]/80 p-4 hover:border-emerald-500/40 hover:bg-[#0d111a] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-white">
            AI Academic Advisor
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Context-aware conversational guidance
          </p>
        </Link>
      </div>

      {/* Main Intelligence Showcase or Empty State */}
      {latest ? (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-[#0e121c] via-[#0c1018] to-[#090c14] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

            <div className="grid gap-8 lg:grid-cols-12 items-center">
              <div className="lg:col-span-5 flex flex-col items-center justify-center text-center border-b border-white/8 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-indigo-400" />
                  Consensus Performance Score
                </span>
                <RadialScoreMeter
                  score={latest.predicted_score}
                  passProbability={latest.pass_probability}
                  riskLevel={latest.risk_level}
                  size={190}
                />
                <div className="mt-5 flex items-center gap-2.5">
                  <RiskBadge level={latest.risk_level} />
                  <span className="text-xs font-semibold text-slate-300">
                    Risk Index: {Math.round(latest.risk_index)} / 100
                  </span>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-2">
                    Academic Trajectory Diagnosis
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {latest.risk_description ||
                      "Inference computed across Random Forest, XGBoost, and CatBoost models."}
                  </p>
                </div>

                {/* Primary Factor Attribution Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/6 bg-white/3 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {profile?.attendance !== undefined && profile?.attendance !== null ? `${profile.attendance}%` : "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/3 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Study Hours</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {profile?.study_hours !== undefined && profile?.study_hours !== null ? `${profile.study_hours} h/day` : "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/3 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sleep Hours</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {profile?.sleep_hours !== undefined && profile?.sleep_hours !== null ? `${profile.sleep_hours} h/day` : "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/3 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Assignments</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {profile?.assignments_completed !== undefined && profile?.assignments_completed !== null ? `${profile.assignments_completed}%` : "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/3 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Participation</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {profile?.participation !== undefined && profile?.participation !== null ? `${profile.participation}%` : "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/3 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Previous Grade</span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {profile?.previous_grade !== undefined && profile?.previous_grade !== null ? `${profile.previous_grade}%` : "-"}
                    </span>
                  </div>
                </div>

                {/* TreeSHAP Feature Attributions Preview */}
                {(latest.top_positive.length > 0 || latest.top_negative.length > 0) && (
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      Key Contributing Factors (TreeSHAP)
                    </h4>
                    <SHAPChart
                      positive={latest.top_positive.slice(0, 3)}
                      negative={latest.top_negative.slice(0, 3)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Academic Calendar Widget */}
          <div className="rounded-2xl border border-white/8 bg-[#0d111a]/80 p-5 backdrop-blur-xl">
            <AcademicCalendarWidget
              dayStatus={dayStatus}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              onStatusUpdated={setDayStatus}
              isLoading={isCalendarLoading}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState
            title="No Predictions Available Yet"
            description="You haven't run any performance simulations yet. Run your first simulation to generate multi-model consensus scores, TreeSHAP explainability, and risk diagnosis."
            actionText="Run Simulation Now"
            onAction={() => navigate("/student/prediction")}
          />

          <div className="rounded-2xl border border-white/8 bg-[#0d111a]/80 p-5 backdrop-blur-xl">
            <AcademicCalendarWidget
              dayStatus={dayStatus}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              onStatusUpdated={setDayStatus}
              isLoading={isCalendarLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};
