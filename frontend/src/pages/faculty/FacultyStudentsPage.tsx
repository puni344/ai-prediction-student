import React, { useEffect, useState, useCallback } from "react";
import { Search, Filter, Eye, X, BookOpen, AlertTriangle, CheckCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { RiskBadge } from "../../components/common/RiskBadge";
import { facultyService } from "../../services/api";
import { FacultyStudentItem, FacultyStudentDetailResponse } from "../../types";

export const FacultyStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<FacultyStudentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [assignedDepartments, setAssignedDepartments] = useState<string[]>([]);

  // Modal / Inspection state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<FacultyStudentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch student directory
  const fetchStudents = useCallback(async (
    searchVal = search,
    deptVal = department,
    riskVal = riskLevel
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await facultyService.getStudents({
        search: searchVal.trim() || undefined,
        department: deptVal || undefined,
        risk_level: riskVal || undefined,
      });
      setStudents(res.students);
      setTotalCount(res.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load student directory.");
    } finally {
      setIsLoading(false);
    }
  }, [search, department, riskLevel]);

  // Initial load: fetch assigned departments & student directory
  useEffect(() => {
    const initData = async () => {
      try {
        const dash = await facultyService.getDashboard();
        if (dash.assigned_departments && dash.assigned_departments.length > 0) {
          setAssignedDepartments(dash.assigned_departments);
        }
      } catch {
        // Fallback
      }
      fetchStudents("", "", "");
    };
    initData();
  }, []);

  // Debounced search when search, department, or riskLevel changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(search, department, riskLevel);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, department, riskLevel]);

  const handleResetFilters = () => {
    setSearch("");
    setDepartment("");
    setRiskLevel("");
    fetchStudents("", "", "");
  };

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

  const getDeptColor = (dept: string) => {
    const d = dept.toLowerCase();
    if (d.includes("computer") || d.includes("cs")) return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
    if (d.includes("information") || d.includes("it")) return "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
    if (d.includes("data")) return "bg-purple-500/10 text-purple-300 border-purple-500/30";
    if (d.includes("electrical") || d.includes("ee")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    return "bg-slate-500/10 text-slate-300 border-slate-500/30";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Student Cohort Directory</h1>
          <p className="mt-1 text-xs text-slate-400">
            Search enrolled students by name, roll number, or email. Department isolation is strictly enforced.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          Showing {students.length} of {totalCount} students
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-white/8 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, roll number, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0e121b] py-2 pl-10 pr-10 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">All Assigned Departments</option>
              {assignedDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0e121b] px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">All Risk Tiers</option>
              <option value="HIGH">High Risk</option>
              <option value="MODERATE">Moderate Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            {(search || department || riskLevel) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Student Directory Content */}
      {isLoading ? (
        <LoadingState message="Filtering student cohort..." />
      ) : error ? (
        <ErrorState title="Directory Error" message={error} onRetry={() => fetchStudents()} />
      ) : students.length === 0 ? (
        <Card className="p-12 text-center border-white/8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">
              {search
                ? `No students found matching '${search}'`
                : "No students match the selected filters"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md">
              {search
                ? "Check your spelling, or verify that the student is enrolled in one of your authorized academic departments."
                : "Try adjusting the department or risk tier filters to see enrolled students."}
            </p>
            {(search || department || riskLevel) && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetFilters}
                className="mt-2"
              >
                Reset Search Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/8 bg-[#0d111a]/80 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/8 bg-white/2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Roll Number</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Attendance</th>
                  <th className="px-6 py-4">Study Hours</th>
                  <th className="px-6 py-4">Predicted Score</th>
                  <th className="px-6 py-4">Risk Tier</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-slate-300">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{st.full_name}</div>
                      <div className="text-[11px] text-slate-400">{st.email}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {st.roll_number || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${getDeptColor(st.department)}`}>
                        {st.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {st.attendance !== null ? `${st.attendance}%` : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {st.study_hours !== null ? `${st.study_hours} h/d` : "—"}
                    </td>
                    <td className="px-6 py-4 font-bold text-white font-mono">
                      {st.latest_predicted_score !== null ? `${st.latest_predicted_score}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {st.latest_risk_level ? (
                        <RiskBadge level={st.latest_risk_level} />
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInspect(st.id)}
                        className="text-xs"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5 text-indigo-400" />
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

      {/* Student Inspection Modal */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0c1018] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {isLoadingDetail ? (
              <LoadingState message="Loading student inspection telemetry..." />
            ) : detailError ? (
              <ErrorState title="Inspection Failed" message={detailError} onRetry={() => handleInspect(selectedStudentId)} />
            ) : detailData ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">{detailData.full_name}</h2>
                    {detailData.latest_prediction && (
                      <RiskBadge level={detailData.latest_prediction.risk_level} />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {detailData.email} • Roll: <span className="font-mono text-slate-200">{detailData.profile.roll_number}</span> • {detailData.profile.department}
                  </p>
                </div>

                {detailData.latest_prediction ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Predicted Score</span>
                      <p className="text-lg font-bold text-white mt-1 font-mono">
                        {detailData.latest_prediction.predicted_score}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pass Probability</span>
                      <p className="text-lg font-bold text-white mt-1 font-mono">
                        {(detailData.latest_prediction.pass_probability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance</span>
                      <p className="text-lg font-bold text-white mt-1 font-mono">
                        {detailData.profile.attendance}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Study Hours</span>
                      <p className="text-lg font-bold text-white mt-1 font-mono">
                        {detailData.profile.study_hours} h/d
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No prediction evaluations recorded yet.</p>
                )}

                <div className="flex justify-end pt-4 border-t border-white/8">
                  <Button variant="primary" size="sm" onClick={() => {
                    closeModal();
                    window.location.href = `/faculty/students/${detailData.profile.id}`;
                  }}>
                    Open Full Inspection Screen
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
