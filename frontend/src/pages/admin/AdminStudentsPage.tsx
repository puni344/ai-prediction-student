import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  Search,
  Eye,
  X,
  ChevronDown,
  Sparkles,
  Filter,
} from "lucide-react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { RiskBadge } from "../../components/common/RiskBadge";
import { adminService } from "../../services/api";
import { DEPARTMENTS } from "../../constants/departments";
import {
  AdminStudentItem,
  FacultyStudentDetailResponse,
} from "../../types";

export const AdminStudentsPage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [students, setStudents] = useState<AdminStudentItem[]>([]);
  const [studentTotal, setStudentTotal] = useState<number>(0);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [studentRiskFilter, setStudentRiskFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Student detail inspection modal
  const [inspectStudentId, setInspectStudentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<FacultyStudentDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchStudents = async (dept: string, searchVal: string, riskVal: string) => {
    setIsLoading(true);
    try {
      const res = await adminService.getStudents({
        department: dept === "all" ? undefined : dept,
        search: searchVal.trim() || undefined,
        risk_level: riskVal || undefined,
        limit: 100,
      });
      setStudents(res.students);
      setStudentTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load students:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(selectedDept, studentSearch, studentRiskFilter);
  }, [selectedDept]);

  const handleInspectStudent = async (id: number) => {
    setInspectStudentId(id);
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await adminService.getStudentDetail(id);
      setDetailData(res);
    } catch (err: any) {
      setDetailError(err.response?.data?.detail || "Failed to load student inspection record.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeInspectModal = () => {
    setInspectStudentId(null);
    setDetailData(null);
    setDetailError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center border-b border-white/8 pb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-300">
              STUDENT MANAGEMENT
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Student Management
            </h1>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Manage and inspect institution students.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Filter by Department:
            </label>
            <div className="relative">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="appearance-none rounded-xl border border-indigo-500/40 bg-[#0d121c] py-2 pl-3.5 pr-9 text-xs font-semibold text-white shadow-lg focus:border-indigo-400 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Departments (Institution-Wide)</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, roll number, or email..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchStudents(selectedDept, studentSearch, studentRiskFilter);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <select
          value={studentRiskFilter}
          onChange={(e) => {
            setStudentRiskFilter(e.target.value);
            fetchStudents(selectedDept, studentSearch, e.target.value);
          }}
          className="appearance-none rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs text-white focus:border-indigo-500 focus:outline-hidden cursor-pointer"
        >
          <option value="">All Risk Tiers</option>
          <option value="HIGH">High Risk</option>
          <option value="MODERATE">Moderate Risk</option>
          <option value="LOW">Low Risk</option>
        </select>

        <Button
          variant="primary"
          size="sm"
          onClick={() => fetchStudents(selectedDept, studentSearch, studentRiskFilter)}
        >
          Search
        </Button>
      </div>

      {/* Students Roster */}
      <Card className="border border-white/8 p-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Institutional Student Directory
          </span>
          <span className="text-xs font-mono text-slate-500">
            Showing {students.length} of {studentTotal} students
          </span>
        </div>

        {isLoading ? (
          <LoadingState message="Querying students..." />
        ) : students.length === 0 ? (
          <EmptyState title="No Students Found" description="No students match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5">Name / Email</th>
                  <th className="py-2.5">Roll Number</th>
                  <th className="py-2.5">Department</th>
                  <th className="py-2.5 text-center">Attendance</th>
                  <th className="py-2.5 text-center">Predicted Score</th>
                  <th className="py-2.5 text-center">Risk Tier</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-2.5">
                      <p className="font-bold text-white">{st.full_name}</p>
                      <p className="text-[11px] text-slate-400">{st.email}</p>
                    </td>
                    <td className="py-2.5 font-mono text-cyan-300 font-semibold">{st.roll_number}</td>
                    <td className="py-2.5 text-slate-300">{st.department}</td>
                    <td className="py-2.5 text-center font-mono">{st.attendance}%</td>
                    <td className="py-2.5 text-center font-mono font-bold text-white">
                      {st.latest_predicted_score !== null
                        ? `${st.latest_predicted_score.toFixed(1)}%`
                        : "\u2014"}
                    </td>
                    <td className="py-2.5 text-center">
                      {st.latest_risk_level ? (
                        <RiskBadge level={st.latest_risk_level} />
                      ) : (
                        <span className="text-slate-500 text-[11px]">Unranked</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInspectStudent(st.id)}
                        className="text-indigo-300 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Student Inspection Modal */}
      {inspectStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/12 bg-[#0c1018] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/8 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Student Academic Telemetry</h3>
              </div>
              <button
                onClick={closeInspectModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoadingDetail ? (
              <LoadingState message="Fetching student telemetry..." />
            ) : detailError ? (
              <ErrorState title="Telemetry Error" message={detailError} />
            ) : detailData ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white/3 p-3.5 rounded-xl border border-white/8">
                  <div>
                    <h4 className="text-base font-bold text-white">{detailData.full_name}</h4>
                    <p className="text-xs text-slate-400 font-mono">
                      {detailData.email} · Roll: {detailData.profile.roll_number}
                    </p>
                  </div>
                  {detailData.latest_prediction && (
                    <RiskBadge level={detailData.latest_prediction.risk_level} />
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                    <span className="text-[10px] text-slate-400 uppercase block">Department</span>
                    <strong className="text-xs text-white">{detailData.profile.department}</strong>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                    <span className="text-[10px] text-slate-400 uppercase block">Attendance</span>
                    <strong className="text-xs text-white">{detailData.profile.attendance}%</strong>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                    <span className="text-[10px] text-slate-400 uppercase block">Study Hours</span>
                    <strong className="text-xs text-white">{detailData.profile.study_hours} hrs/day</strong>
                  </div>
                </div>

                {detailData.latest_prediction && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-white">Latest Predicted Exam Score</span>
                      <strong className="text-lg font-black text-cyan-300">
                        {detailData.latest_prediction.predicted_score.toFixed(1)}%
                      </strong>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {detailData.latest_prediction.risk_description || "Consistent academic indicators."}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
