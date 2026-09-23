import React, { useState, useEffect, useCallback } from "react";
import { facultyService } from "../../services/api";
import { FacultyStudentItem, SnapshotTrendResponse, BucketTrendItem } from "../../types";
import { Card } from "../../components/common/Card";
import { LoadingState } from "../../components/common/LoadingState";
import { RiskBadge } from "../../components/common/RiskBadge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  Search,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  Info,
  GraduationCap,
  Hash,
} from "lucide-react";

type TimeframeTab = "day" | "week" | "month" | "year";

export const FacultyPerformanceAnalysisPage: React.FC = () => {
  // Department & Student Selection State
  const [assignedDepts, setAssignedDepts] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [students, setStudents] = useState<FacultyStudentItem[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<FacultyStudentItem[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<FacultyStudentItem | null>(null);

  // Performance Analysis State
  const [activeTab, setActiveTab] = useState<TimeframeTab>("day");
  const [trendData, setTrendData] = useState<SnapshotTrendResponse | null>(null);
  const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch faculty assigned departments on mount
  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoadingDepts(true);
      setError(null);
      try {
        const dash = await facultyService.getDashboard();
        const depts = dash.assigned_departments || [];
        setAssignedDepts(depts);
        if (depts.length === 1) {
          setSelectedDept(depts[0]);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load assigned departments.");
      } finally {
        setIsLoadingDepts(false);
      }
    };
    fetchDashboard();
  }, []);

  // 2. Fetch students when selected department changes
  useEffect(() => {
    if (!selectedDept) {
      setStudents([]);
      setFilteredStudents([]);
      setSelectedStudent(null);
      return;
    }

    const fetchStudentsForDept = async () => {
      setIsLoadingStudents(true);
      setError(null);
      setSelectedStudent(null);
      try {
        const res = await facultyService.getStudents({
          department: selectedDept,
          limit: 100,
        });
        setStudents(res.students || []);
        setFilteredStudents(res.students || []);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load students for selected department.");
      } finally {
        setIsLoadingStudents(false);
      }
    };
    fetchStudentsForDept();
  }, [selectedDept]);

  // 3. Search students within selected department
  useEffect(() => {
    if (!studentSearch.trim()) {
      setFilteredStudents(students);
    } else {
      const q = studentSearch.toLowerCase();
      setFilteredStudents(
        students.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            (s.roll_number && s.roll_number.toLowerCase().includes(q))
        )
      );
    }
  }, [studentSearch, students]);

  // 4. Fetch performance trends for selected student
  const fetchTrends = useCallback(async (studentId: number, tab: TimeframeTab) => {
    setIsLoadingTrends(true);
    setError(null);
    try {
      const data = await facultyService.getStudentTrends(studentId, tab);
      setTrendData(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load performance analysis data.");
    } finally {
      setIsLoadingTrends(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchTrends(selectedStudent.id, activeTab);
    } else {
      setTrendData(null);
    }
  }, [selectedStudent, activeTab, fetchTrends]);

  const buckets: BucketTrendItem[] = trendData?.bucket_trends || [];
  const validBuckets = buckets.filter((b) => b.has_data !== false && b.avg_predicted_score !== null);
  const sufficiency = trendData?.data_sufficiency;
  const isInsufficient =
    sufficiency?.status === "insufficient" ||
    sufficiency?.status === "empty" ||
    (trendData && trendData.total_days < 2);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <BarChart3 className="h-6 w-6 text-indigo-400" />
          Student Performance Analysis
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Analyze longitudinal academic trajectories, risk indicators, and performance trends within your authorized department scope.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Department & Student Selectors */}
      <Card className="border border-white/8 bg-[#0e121b]/80 p-5 backdrop-blur-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Department Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-400" />
              Assigned Department <span className="text-rose-400">*</span>
            </label>
            {isLoadingDepts ? (
              <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ) : assignedDepts.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 font-semibold">
                No departments assigned.
              </div>
            ) : (
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setStudentSearch("");
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0a0d15] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Department ▼</option>
                {assignedDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Student Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-400" />
              Select Student <span className="text-rose-400">*</span>
            </label>
            {!selectedDept ? (
              <div className="rounded-xl border border-white/10 bg-white/4 p-2.5 text-xs text-slate-500 italic">
                Please select a department first.
              </div>
            ) : isLoadingStudents ? (
              <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ) : students.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/4 p-2.5 text-xs text-slate-400">
                No students enrolled in {selectedDept}.
              </div>
            ) : (
              <select
                value={selectedStudent?.id || ""}
                onChange={(e) => {
                  const sid = parseInt(e.target.value, 10);
                  const st = students.find((s) => s.id === sid) || null;
                  setSelectedStudent(st);
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0a0d15] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Student ▼</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.roll_number ? `(${s.roll_number})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Optional Search filter inside selected department */}
        {selectedDept && students.length > 5 && (
          <div className="relative pt-1">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder={`Filter among ${students.length} students in ${selectedDept}...`}
              className="w-full rounded-xl border border-white/10 bg-white/4 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        )}
      </Card>

      {/* Selected Student Banner */}
      {selectedStudent && (
        <Card className="border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-[#0e121b] to-[#0e121b] p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{selectedStudent.full_name}</h2>
                {selectedStudent.latest_risk_level && (
                  <RiskBadge level={selectedStudent.latest_risk_level as any} />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Building2 className="h-3 w-3 text-indigo-400" />
                  {selectedStudent.department || "No Department"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <GraduationCap className="h-3 w-3 text-cyan-400" />
                  {selectedStudent.academic_year || "Academic Year Pending"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-slate-400">
                  <Hash className="h-3 w-3 text-amber-400" />
                  Roll: {selectedStudent.roll_number || "Not Assigned"}
                </span>
              </div>
            </div>

            {/* Timeframe Controls: [ DAY ] [ WEEK ] [ MONTH ] [ YEAR ] */}
            <div className="flex items-center rounded-xl border border-white/10 bg-[#07090e] p-1 shadow-inner">
              {(["day", "week", "month", "year"] as TimeframeTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    activeTab === tab
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Performance Analysis Charts */}
      {selectedStudent && (
        <>
          {isLoadingTrends ? (
            <LoadingState message="Loading longitudinal snapshot analytics..." />
          ) : !trendData ? (
            <Card className="p-8 text-center text-slate-400">
              Select a timeframe to view analytics.
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 bg-[#0e121b]/80 border border-white/8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      Average Predicted Score
                    </span>
                    <BarChart3 className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">
                    {trendData.avg_predicted_score !== null
                      ? `${trendData.avg_predicted_score}%`
                      : "—"}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Arithmetic mean across {trendData.total_days} recorded snapshot days
                  </p>
                </Card>

                <Card className="p-4 bg-[#0e121b]/80 border border-white/8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      Trend Direction
                    </span>
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black capitalize text-white">
                    {trendData.improvement_pattern || "Stable"}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Calculated slope of linear regression over time
                  </p>
                </Card>

                <Card className="p-4 bg-[#0e121b]/80 border border-white/8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      Data Sufficiency
                    </span>
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      sufficiency?.status === "sufficient"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {sufficiency?.status === "sufficient" ? "Sufficient Data" : "Accumulating Data"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {sufficiency?.message || `${trendData.total_days} daily snapshots analyzed`}
                  </p>
                </Card>
              </div>

              {/* Bucket Trend Cards */}
              <Card className="border border-white/8 bg-[#0e121b]/90 p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/8 pb-4 mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-400" />
                    {activeTab === "day"
                      ? "Daily Snapshots (Last 30 Calendar Days)"
                      : activeTab === "week"
                      ? "Weekly Aggregation (5 Consecutive Calendar Weeks)"
                      : activeTab === "month"
                      ? "Monthly Aggregation"
                      : "Yearly Aggregation (12 Consecutive Months)"}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    {validBuckets.length} bucket(s) with data
                  </span>
                </div>

                {validBuckets.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">
                    <Info className="mx-auto h-8 w-8 text-slate-500 mb-2" />
                    <p className="font-semibold text-slate-300">Not Enough Historical Snapshots Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Official daily snapshots are recorded every morning at 09:00 AM IST. Once more snapshots are logged, longitudinal charts will populate here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {buckets.map((b, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between rounded-xl p-3 border transition-all ${
                          b.has_data !== false
                            ? "border-white/8 bg-white/3 hover:bg-white/6"
                            : "border-white/4 bg-white/1 opacity-50"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{b.bucket_label}</p>
                          {b.sub_label && <p className="text-[10px] text-slate-400 mt-0.5">{b.sub_label}</p>}
                        </div>

                        <div className="flex items-center gap-4">
                          {b.avg_predicted_score !== null ? (
                            <div className="text-right">
                              <span className="text-sm font-black text-indigo-300 font-mono">
                                {b.avg_predicted_score}%
                              </span>
                              <p className="text-[10px] text-slate-500">
                                {b.snapshot_count} snapshot(s)
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600 italic">No snapshots</span>
                          )}

                          {b.risk_level && (
                            <RiskBadge level={b.risk_level as any} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Formula & Definitions Card */}
              <Card className="border border-white/8 bg-white/2 p-5 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Info className="h-4 w-4 text-indigo-400" />
                  <span>Authoritative Calculation Standards</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-400">
                  <li><strong>Day View:</strong> Individual daily official snapshots across the past 30 calendar days.</li>
                  <li><strong>Week View:</strong> Exactly 5 consecutive calendar-week buckets computed from Monday to Sunday.</li>
                  <li><strong>Month View:</strong> Calendar-month aggregations of arithmetic mean scores.</li>
                  <li><strong>Year View:</strong> Exactly 12 consecutive calendar months with zero fabricated data.</li>
                  <li><strong>Zero Fabrication Rule:</strong> Missing days/buckets are never filled with synthetic zeroes.</li>
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};
