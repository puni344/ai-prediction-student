import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, Eye, X, CheckCircle2, ChevronRight, Activity } from "lucide-react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { RiskBadge } from "../../components/common/RiskBadge";
import { facultyService } from "../../services/api";
import { FacultyRiskResponse, FacultyStudentDetailResponse } from "../../types";

export const FacultyRiskPage: React.FC = () => {
  const [data, setData] = useState<FacultyRiskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>("");

  // Inspection modal state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<FacultyStudentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchRiskData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await facultyService.getRiskAnalysis({ risk_level: riskFilter || undefined });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load risk analysis data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, [riskFilter]);

  const handleInspect = async (studentId: number) => {
    setSelectedStudentId(studentId);
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await facultyService.getStudentDetail(studentId);
      setDetailData(res);
    } catch (err: any) {
      setDetailError(err.response?.data?.detail || "Failed to load student inspection record.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedStudentId(null);
    setDetailData(null);
    setDetailError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Early Warning Risk Monitoring</h1>
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
            Triage Console
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Prioritized roster sorted with high-risk cases first for immediate counseling intervention.
        </p>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRiskFilter("")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              riskFilter === ""
                ? "bg-white text-slate-950 font-bold shadow-sm"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            All Students ({data?.total_flagged ?? 0})
          </button>
          <button
            onClick={() => setRiskFilter("HIGH")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              riskFilter === "HIGH"
                ? "bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/30"
                : "bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20"
            }`}
          >
            High Risk ({data?.high_risk_count ?? 0})
          </button>
          <button
            onClick={() => setRiskFilter("MODERATE")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              riskFilter === "MODERATE"
                ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30"
                : "bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
            }`}
          >
            Moderate Risk ({data?.moderate_risk_count ?? 0})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <span>High-risk cases are automatically sorted to the top.</span>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Ranking cohort by deterministic risk index..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRiskData} />
      ) : !data || data.students.length === 0 ? (
        <EmptyState
          title="No Flagged Students"
          description="No students match the selected risk criteria. All monitored students are performing satisfactorily."
          icon={ShieldCheck}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0d111a]/85 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-10 border-b border-white/8 bg-[#0e121b]/95 backdrop-blur-md text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Roll No</th>
                  <th className="px-4 py-3.5">Risk Tier & Severity</th>
                  <th className="px-5 py-3.5">Diagnostic Reason</th>
                  <th className="px-4 py-3.5">Predicted Score</th>
                  <th className="px-4 py-3.5">Attendance</th>
                  <th className="px-4 py-3.5">Study Hrs</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {data.students.map((st) => (
                  <tr
                    key={st.student_id}
                    className={`group transition-all ${
                      st.risk_level === "HIGH"
                        ? "bg-rose-500/5 hover:bg-rose-500/10"
                        : st.risk_level === "MODERATE"
                        ? "bg-amber-500/5 hover:bg-amber-500/10"
                        : "hover:bg-white/3"
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {st.full_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{st.department}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">
                      {st.roll_number || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <RiskBadge level={st.risk_level} />
                          <span className="font-mono text-xs font-bold text-white">
                            {st.risk_index.toFixed(1)}
                          </span>
                        </div>
                        {/* Visual Severity Bar */}
                        <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              st.risk_level === "HIGH"
                                ? "bg-rose-500"
                                : st.risk_level === "MODERATE"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(8, st.risk_index))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {st.risk_description}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-white">
                      {st.predicted_score.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 font-semibold font-mono text-white">
                      {st.attendance}%
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono">
                      {st.study_hours} h/wk
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant={st.risk_level === "HIGH" ? "danger" : "outline"}
                        onClick={() => handleInspect(st.student_id)}
                      >
                        <Eye className="mr-1.5 h-3 w-3" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      {selectedStudentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d111a] p-6 shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {isLoadingDetail ? (
              <LoadingState message="Retrieving student telemetry & ML history..." />
            ) : detailError ? (
              <ErrorState message={detailError} onRetry={() => handleInspect(selectedStudentId)} />
            ) : detailData ? (
              <div className="space-y-5">
                <div className="border-b border-white/8 pb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{detailData.full_name}</h2>
                    <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                      {detailData.profile.department}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {detailData.email} • Roll: {detailData.profile.roll_number || "Unassigned"}
                  </p>
                </div>

                {detailData.latest_prediction && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                        Diagnostic Assessment
                      </span>
                      <RiskBadge level={detailData.latest_prediction.risk_level} />
                    </div>
                    <p className="mt-2 text-xs text-slate-200 leading-relaxed">
                      {detailData.latest_prediction.risk_description}
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={closeModal}>
                    Close Inspector
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
