import { extractErrorMessage } from "../../utils/errors";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { studentService, predictionService } from "../../services/api";
import {
  StudentProfile,
  DailySnapshotResponse,
  
  PredictionSimulationRequest,
  PredictionResponse,
} from "../../types";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { RiskBadge } from "../../components/common/RiskBadge";
import {
  Sparkles,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Sliders,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const PredictionPage: React.FC = () => {
  const navigate = useNavigate();

  // Core Data States
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [todaySnapshot, setTodaySnapshot] = useState<DailySnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // What-If Simulation State (Strictly Separated from Official Snapshot)
  const [showWhatIf, setShowWhatIf] = useState(false);
    const [whatIfStrings, setWhatIfStrings] = useState<{
    study_hours: string;
    attendance: string;
    sleep_hours: string;
    assignments_completed: string;
  }>({
    study_hours: "",
    attendance: "",
    sleep_hours: "",
    assignments_completed: "",
  });

  const [whatIfForm, setWhatIfForm] = useState<PredictionSimulationRequest>({
    study_hours: 0,
    attendance: 0,
    sleep_hours: 0,
    assignments_completed: 0,
    participation: 0,
  });
  const [whatIfResult, setWhatIfResult] = useState<PredictionResponse | null>(null);
  const [isComputingWhatIf, setIsComputingWhatIf] = useState(false);
  const [whatIfSavedNotice, setWhatIfSavedNotice] = useState<string | null>(null);

  // Load Official Academic Snapshot & Aggregated Trends
  const loadOfficialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch student profile
      const prof = await studentService.getProfile();
      setProfile(prof);

      // Initialize what-if form with current profile values
      if (prof) {
                setWhatIfStrings({
          study_hours: String(prof.study_hours ?? 0),
          attendance: String(prof.attendance ?? 0),
          sleep_hours: String(prof.sleep_hours ?? 0),
          assignments_completed: String(prof.assignments_completed ?? 0),
        });
        setWhatIfForm({
          study_hours: prof.study_hours,
          attendance: prof.attendance,
          sleep_hours: prof.sleep_hours,
          assignments_completed: prof.assignments_completed,
          participation: prof.participation,
        });
      }

      // 2. Fetch today's official daily snapshot
      // (catch-up mechanism generates it if >= 09:00 AM)
      const snap = await predictionService.getTodaySnapshot();
      setTodaySnapshot(snap);

      } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to load academic snapshot data."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfficialData();
  }, [loadOfficialData]);

  // Run What-If Simulation (Temporary preview — DOES NOT save snapshot)
  const handleRunWhatIf = async () => {
    setIsComputingWhatIf(true);
    setWhatIfSavedNotice(null);
    try {
      const res = await predictionService.simulate(whatIfForm);
      setWhatIfResult(res);
    } catch (err: any) {
      setError(extractErrorMessage(err, "What-If calculation failed."));
    } finally {
      setIsComputingWhatIf(false);
    }
  };

  // Save What-If values to Profile for Tomorrow's Snapshot
  const handleApplyToProfile = async () => {
    if (!profile) return;
    try {
      await studentService.updateProfile({
        ...profile,
        study_hours: Number(whatIfForm.study_hours),
        attendance: Number(whatIfForm.attendance),
        sleep_hours: Number(whatIfForm.sleep_hours),
        assignments_completed: Number(whatIfForm.assignments_completed),
        participation: Number(whatIfForm.participation),
      });
      setWhatIfSavedNotice("Profile updated successfully! These values will become the input for tomorrow's 09:00 AM snapshot.");
      // Refresh profile
      const updated = await studentService.getProfile();
      setProfile(updated);
    } catch (err: any) {
      setError("Failed to update profile values.");
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading your official academic performance intelligence..." />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Page Header & Clarity Banner */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
              Academic Performance Intelligence
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Authoritative daily performance analysis, risk monitoring, and study recommendations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={showWhatIf ? "primary" : "secondary"}
              onClick={() => {
                setShowWhatIf(!showWhatIf);
                if (!showWhatIf && !whatIfResult) {
                  handleRunWhatIf();
                }
              }}
              className="flex items-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              {showWhatIf ? "Hide What-If Preview" : "Explore What-If Preview"}
            </Button>
          </div>
        </div>

        {/* 5-Second Clarity Notice */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">Daily Snapshot Rule:</span> Exactly{" "}
            <span className="text-indigo-300 font-medium">ONE official academic snapshot</span> is recorded per day
            at <span className="text-indigo-300 font-medium">09:00 AM (Asia/Kolkata)</span> using your latest saved profile.
            Subsequent profile updates serve as inputs for the next day's snapshot.
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-4 text-rose-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Official Daily Academic Snapshot (Hero Section) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Official Daily Snapshot
            </span>
            <span className="text-xs text-slate-400">
              Date: <span className="text-slate-200 font-medium">{todaySnapshot?.snapshot_date || "Today"}</span> (Recorded 09:00 AM Asia/Kolkata)
            </span>
          </div>

          <span className="text-xs text-slate-500">Immutable Academic Record</span>
        </div>

        {todaySnapshot ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Metric: Predicted Performance */}
            <Card className="bg-slate-900/90 border-slate-800 p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Predicted Performance
                  </span>
                  <RiskBadge level={todaySnapshot.risk_level as any} />
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-white tracking-tight">
                    {Math.round(todaySnapshot.predicted_score)}
                  </span>
                  <span className="text-slate-400 font-medium text-lg">/ 100</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Passing Standard</span>
                    <span className="font-semibold text-slate-200">40 / 100</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Pass Probability</span>
                    <span className="font-semibold text-emerald-400">
                      {Math.round(todaySnapshot.pass_probability * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Risk Index</span>
                    <span className="font-semibold text-slate-200">{todaySnapshot.risk_index} / 100</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400 leading-normal">
                {todaySnapshot.risk_level === "LOW" && (
                  <p className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Safe academic trajectory. Your study habits support steady exam success.
                  </p>
                )}
                {todaySnapshot.risk_level === "MODERATE" && (
                  <p className="text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Moderate risk detected. Action recommended in study focus areas.
                  </p>
                )}
                {todaySnapshot.risk_level === "HIGH" && (
                  <p className="text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    High risk detected. Immediate improvement in attendance or study hours needed.
                  </p>
                )}
              </div>
            </Card>

            {/* Main Factors (Plain-Language SHAP) */}
            <Card className="bg-slate-900/90 border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Main Factors
                </h3>
                <span className="text-xs text-slate-500">Key Academic Drivers</span>
              </div>

              <p className="text-xs text-slate-400">
                These are the primary academic factors influencing your predicted score today:
              </p>

              <div className="space-y-3">
                {/* Positive Drivers */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                    Top Positive Drivers
                  </span>
                  {todaySnapshot.shap_data?.main_positive_factors?.slice(0, 2).map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-200 font-medium">{item.factor}</span>
                      <span className="text-emerald-400 font-bold">+{item.impact} pts</span>
                    </div>
                  ))}
                  {(!todaySnapshot.shap_data?.main_positive_factors || todaySnapshot.shap_data.main_positive_factors.length === 0) && (
                    <div className="text-xs text-slate-500 italic">No significant positive drivers recorded.</div>
                  )}
                </div>

                {/* Challenges */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                    Areas Needing Focus
                  </span>
                  {todaySnapshot.shap_data?.main_negative_factors?.slice(0, 2).map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-200 font-medium">{item.factor}</span>
                      <span className="text-rose-400 font-bold">{item.impact} pts</span>
                    </div>
                  ))}
                  {(!todaySnapshot.shap_data?.main_negative_factors || todaySnapshot.shap_data.main_negative_factors.length === 0) && (
                    <div className="text-xs text-slate-500 italic">No critical drag factors identified today.</div>
                  )}
                </div>
              </div>
            </Card>

            {/* Study Focus (Deterministic Recommendations) */}
            <Card className="bg-slate-900/90 border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Study Focus
                </h3>
                <span className="text-xs text-slate-500">Actionable Steps</span>
              </div>

              <div className="space-y-2.5">
                {todaySnapshot.recommendation_data?.items?.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{item.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                          item.priority === "High"
                            ? "bg-rose-500/20 text-rose-300"
                            : item.priority === "Medium"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-indigo-500/20 text-indigo-300"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.action}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/student/timetable")}
                  className="w-full text-xs flex items-center justify-center gap-2"
                >
                  <span>Open Daily Timetable Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="bg-slate-900/80 border-slate-800 p-8 text-center space-y-3">
            <Clock className="w-10 h-10 text-indigo-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">
              Today's Official Snapshot Scheduled for 09:00 AM
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Official snapshots are recorded automatically every morning at 09:00 AM Asia/Kolkata.
              You can explore hypothetical changes right now using the What-If Preview below.
            </p>
          </Card>
        )}
      </div>

      {/* 3. What-If Preview (Strictly Separated Simulation) */}
      {showWhatIf && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-200">
                  What-If Preview (Hypothetical Simulation)
                </h3>
                <p className="text-xs text-amber-300/80 leading-relaxed mt-0.5">
                  Explore how changes to your study habits would impact your performance.
                  This preview is <span className="font-bold underline">temporary</span> and does NOT overwrite today's official snapshot.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyToProfile}
              className="bg-amber-600 hover:bg-amber-500 text-white shrink-0 text-xs"
            >
              Apply to Profile for Tomorrow
            </Button>
          </div>

          {whatIfSavedNotice && (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{whatIfSavedNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Controls */}
            <Card className="bg-slate-900/90 border-slate-800 p-6 space-y-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Adjust What-If Parameters
              </h4>

              {/* Study Hours */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Daily Study Hours</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={whatIfStrings.study_hours}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\d*\.?\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, study_hours: val }));
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            setWhatIfForm((prev) => ({ ...prev, study_hours: parsed }));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (whatIfStrings.study_hours === "") {
                          setWhatIfStrings((prev) => ({ ...prev, study_hours: "0" }));
                          setWhatIfForm((prev) => ({ ...prev, study_hours: 0 }));
                        }
                      }}
                      className="w-16 px-2 py-0.5 text-right font-mono text-xs rounded bg-slate-800 border border-slate-700 text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400 font-medium">hrs</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="14"
                  step="0.5"
                  value={Number(whatIfForm.study_hours) || 0}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWhatIfStrings((prev) => ({ ...prev, study_hours: val }));
                    setWhatIfForm((prev) => ({ ...prev, study_hours: parseFloat(val) }));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Attendance */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Class Attendance Rate</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={whatIfStrings.attendance}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\d*\.?\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, attendance: val }));
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            setWhatIfForm((prev) => ({ ...prev, attendance: parsed }));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (whatIfStrings.attendance === "") {
                          setWhatIfStrings((prev) => ({ ...prev, attendance: "0" }));
                          setWhatIfForm((prev) => ({ ...prev, attendance: 0 }));
                        }
                      }}
                      className="w-16 px-2 py-0.5 text-right font-mono text-xs rounded bg-slate-800 border border-slate-700 text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400 font-medium">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Number(whatIfForm.attendance) || 0}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWhatIfStrings((prev) => ({ ...prev, attendance: val }));
                    setWhatIfForm((prev) => ({ ...prev, attendance: parseFloat(val) }));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Sleep Hours */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Nightly Sleep Duration</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={whatIfStrings.sleep_hours}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\d*\.?\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, sleep_hours: val }));
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            setWhatIfForm((prev) => ({ ...prev, sleep_hours: parsed }));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (whatIfStrings.sleep_hours === "") {
                          setWhatIfStrings((prev) => ({ ...prev, sleep_hours: "0" }));
                          setWhatIfForm((prev) => ({ ...prev, sleep_hours: 0 }));
                        }
                      }}
                      className="w-16 px-2 py-0.5 text-right font-mono text-xs rounded bg-slate-800 border border-slate-700 text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400 font-medium">hrs</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="14"
                  step="0.5"
                  value={Number(whatIfForm.sleep_hours) || 0}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWhatIfStrings((prev) => ({ ...prev, sleep_hours: val }));
                    setWhatIfForm((prev) => ({ ...prev, sleep_hours: parseFloat(val) }));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Assignments Completed */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Assignment Completion</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={whatIfStrings.assignments_completed}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        if (rawVal === "" || /^\d*\.?\d*$/.test(rawVal)) {
                          const val = rawVal.replace(/^0+(?=\d)/, "");
                          setWhatIfStrings((prev) => ({ ...prev, assignments_completed: val }));
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            setWhatIfForm((prev) => ({ ...prev, assignments_completed: parsed }));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (whatIfStrings.assignments_completed === "") {
                          setWhatIfStrings((prev) => ({ ...prev, assignments_completed: "0" }));
                          setWhatIfForm((prev) => ({ ...prev, assignments_completed: 0 }));
                        }
                      }}
                      className="w-16 px-2 py-0.5 text-right font-mono text-xs rounded bg-slate-800 border border-slate-700 text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400 font-medium">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Number(whatIfForm.assignments_completed) || 0}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWhatIfStrings((prev) => ({ ...prev, assignments_completed: val }));
                    setWhatIfForm((prev) => ({
                      ...whatIfForm,
                      assignments_completed: parseFloat(val),
                    }));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <Button
                variant="secondary"
                onClick={handleRunWhatIf}
                disabled={isComputingWhatIf}
                className="w-full text-xs"
              >
                {isComputingWhatIf ? "Calculating Preview..." : "Recalculate What-If Preview"}
              </Button>
            </Card>

            {/* What-If Output Display */}
            <Card className="bg-slate-900/90 border-slate-800 p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    What-If Preview Result
                  </span>
                  {whatIfResult && <RiskBadge level={whatIfResult.risk_level as any} />}
                </div>

                {whatIfResult ? (
                  <div className="space-y-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-black text-amber-300 tracking-tight">
                        {Math.round(whatIfResult.predicted_score)}
                      </span>
                      <span className="text-slate-400 font-medium text-lg">/ 100</span>
                    </div>

                    {/* Delta comparison vs today's snapshot */}
                    {todaySnapshot && (
                      <div className="bg-slate-800/60 rounded-lg p-3 text-xs flex items-center justify-between">
                        <span className="text-slate-300">Delta vs Today's Snapshot:</span>
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            whatIfResult.predicted_score >= todaySnapshot.predicted_score
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {whatIfResult.predicted_score >= todaySnapshot.predicted_score ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {whatIfResult.predicted_score >= todaySnapshot.predicted_score ? "+" : ""}
                          {Math.round((whatIfResult.predicted_score - todaySnapshot.predicted_score) * 10) / 10} pts
                        </span>
                      </div>
                    )}

                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Projected Pass Probability</span>
                        <span className="font-semibold text-white">
                          {Math.round(whatIfResult.pass_probability * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Projected Risk Index</span>
                        <span className="font-semibold text-white">
                          {whatIfResult.risk_index} / 100
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Adjust sliders and click "Recalculate What-If Preview" to preview changes.
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-500 text-center">
                This preview is strictly temporary. The official daily snapshot will only update at tomorrow's 09:00 AM simulation.
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
