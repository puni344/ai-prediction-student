import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  BookOpen,
  Calendar,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { RiskBadge } from "../../components/common/RiskBadge";
import { RadialScoreMeter } from "../../components/ui/RadialScoreMeter";
import { facultyService } from "../../services/api";
import { FacultyStudentDetailResponse, DailySnapshotResponse } from "../../types";
import { PerformanceAnalysisSidebar } from "../../components/analytics/PerformanceAnalysisSidebar";

export const FacultyStudentDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<FacultyStudentDetailResponse | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshotResponse[]>([]);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!studentId || isNaN(Number(studentId))) {
        setError("Invalid student ID.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const [res, snapData] = await Promise.all([
          facultyService.getStudentDetail(Number(studentId)),
          facultyService.getStudentSnapshots(Number(studentId), 365),
        ]);
        setData(res);
        setSnapshots(snapData || []);
      } catch (err: any) {
        if (err.response?.status === 404 || err.response?.status === 403) {
          setError("Student record not found or not in your assigned departments.");
        } else {
          setError(err.response?.data?.detail || "Failed to load student inspection record.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingState message="Fetching student inspection telemetry..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/faculty/students")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Student Directory
        </Button>
        <ErrorState
          title="Access Restricted or Student Not Found"
          message={error || "Could not retrieve student data."}
          onRetry={() => navigate("/faculty/students")}
        />
      </div>
    );
  }

  const { profile, full_name, email, latest_prediction, prediction_history } = data;

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      {/* MAIN FACULTY STUDENT DETAIL (LEFT) */}
      <div className="flex-1 min-w-0 space-y-6 w-full">
      {/* Top navigation back button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/faculty/students")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Student Directory
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAnalysisOpen((prev) => !prev)}
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-xs"
          >
            <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-indigo-400" />
            Performance Analysis
          </Button>
          <span className="text-xs font-mono text-slate-400">
            Student ID #{profile.id} • Department Isolation Enforced
          </span>
        </div>
      </div>

      {/* Header Profile Card */}
      <Card className="border border-white/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shadow-inner">
              <User className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">{full_name}</h1>
                {latest_prediction && <RiskBadge level={latest_prediction.risk_level} />}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {email} • Roll No: <strong className="text-slate-200 font-mono">{profile.roll_number || "N/A"}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
              {profile.department}
            </span>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
              {profile.academic_year}
            </span>
          </div>
        </div>
      </Card>

      {/* Primary Metrics Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Latest Prediction Overview */}
        <Card className="border border-white/10 p-6 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Latest Consensus Outcome
          </span>
          {latest_prediction ? (
            <>
              <RadialScoreMeter
                score={latest_prediction.predicted_score}
                passProbability={latest_prediction.pass_probability}
                riskLevel={latest_prediction.risk_level}
                size={180}
              />
              <div className="mt-4 flex items-center gap-2">
                <RiskBadge level={latest_prediction.risk_level} />
                <span className="text-xs font-semibold text-slate-300">
                  {(latest_prediction.pass_probability * 100).toFixed(1)}% Pass Probability
                </span>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              No evaluation record available for this student.
            </div>
          )}
        </Card>

        {/* Behavioral Attributes */}
        <Card className="border border-white/10 p-6 lg:col-span-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3 mb-4">
            Academic & Behavioral Attributes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Attendance Rate</span>
              <p className="mt-1 text-base font-bold text-white">{profile.attendance}%</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Study Hours</span>
              <p className="mt-1 text-base font-bold text-white">{profile.study_hours} hrs/day</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Assignments</span>
              <p className="mt-1 text-base font-bold text-white">{profile.assignments_completed}%</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Previous Grade</span>
              <p className="mt-1 text-base font-bold text-white">{profile.previous_grade}%</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Sleep Hours</span>
              <p className="mt-1 text-base font-bold text-white">{profile.sleep_hours} hrs</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Extra Classes</span>
              <p className="mt-1 text-base font-bold text-white uppercase">{profile.extra_classes}</p>
            </div>
          </div>



      {/* TreeSHAP Drivers */}
          {latest_prediction && (
            <div className="mt-6 border-t border-white/8 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                Key TreeSHAP Attribution Vectors
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                    Top Positive Drivers
                  </span>
                  {latest_prediction.top_positive.length > 0 ? (
                    latest_prediction.top_positive.map((tp, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-300 py-0.5">
                        <span>{tp.feature}</span>
                        <strong className="text-emerald-400 font-mono">+{tp.contribution.toFixed(2)}</strong>
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500">None identified</span>
                  )}
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                    Top Negative Drivers
                  </span>
                  {latest_prediction.top_negative.length > 0 ? (
                    latest_prediction.top_negative.map((tn, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-300 py-0.5">
                        <span>{tn.feature}</span>
                        <strong className="text-rose-400 font-mono">{tn.contribution.toFixed(2)}</strong>
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500">None identified</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Prediction History Table */}
      {prediction_history.length > 0 && (
        <Card className="border border-white/10 p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3 mb-4">
            Historical Trajectory Evaluations ({prediction_history.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Predicted Score</th>
                  <th className="py-2.5">Pass Probability</th>
                  <th className="py-2.5">Risk Level</th>
                  <th className="py-2.5">Risk Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {prediction_history.map((rec) => (
                  <tr key={rec.id} className="text-slate-300">
                    <td className="py-2.5 font-mono text-slate-400">
                      {new Date(rec.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 font-bold text-white">{rec.predicted_score.toFixed(1)}%</td>
                    <td className="py-2.5">{(rec.pass_probability * 100).toFixed(1)}%</td>
                    <td className="py-2.5">
                      <RiskBadge level={rec.risk_level} />
                    </td>
                    <td className="py-2.5 font-mono">{rec.risk_index.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </div>

      {/* PERFORMANCE ANALYSIS SIDEBAR (DESKTOP DEDICATED RIGHT PANEL) */}
      {isAnalysisOpen && (
        <div className="hidden xl:block w-[380px] shrink-0 sticky top-20">
          <PerformanceAnalysisSidebar
            snapshots={snapshots}
            title="STUDENT PERFORMANCE ANALYSIS"
            subtitle="Historical performance trajectory for this student in your department."
            onClose={() => setIsAnalysisOpen(false)}
          />
        </div>
      )}

      {/* MOBILE / TABLET SLIDE-OVER DRAWER */}
      {isAnalysisOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md h-full overflow-y-auto p-4 bg-[#07090e]">
            <PerformanceAnalysisSidebar
              snapshots={snapshots}
              title="STUDENT PERFORMANCE ANALYSIS"
              subtitle="Historical performance trajectory for this student in your department."
              onClose={() => setIsAnalysisOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
