import React, { useEffect, useState } from "react";
import {
  Building2,
  Users,
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  Activity,
  ChevronDown,
} from "lucide-react";
import { Card } from "../../components/common/Card";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { adminService } from "../../services/api";
import { DEPARTMENTS } from "../../constants/departments";
import { AdminOverviewResponse } from "../../types";

export const AdminDashboard: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const fetchOverview = async (dept: string) => {
    setIsLoadingOverview(true);
    setOverviewError(null);
    setOverview(null); // Clear previous data to prevent stale display
    try {
      const data = await adminService.getOverview(dept === "all" ? undefined : dept);
      setOverview(data);
    } catch (err: any) {
      setOverviewError(err.response?.data?.detail || "Failed to load institutional overview.");
    } finally {
      setIsLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchOverview(selectedDept);
  }, [selectedDept]);

  const viewingLabel =
    selectedDept === "all"
      ? "Institution-wide"
      : selectedDept;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center border-b border-white/8 pb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300">
              INSTITUTIONAL OVERVIEW
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Institutional Overview
            </h1>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Monitor institution-wide academic performance and risk.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">
              Viewing: {viewingLabel}
            </span>
          </div>
        </div>

        {/* Central Department Filter Dropdown */}
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

      {/* Overview Content */}
      {isLoadingOverview ? (
        <LoadingState message="Loading institutional telemetry..." />
      ) : overviewError ? (
        <ErrorState title="Error Loading Overview" message={overviewError} onRetry={() => fetchOverview(selectedDept)} />
      ) : overview ? (
        <>
          {/* Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="border border-white/8 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Students
              </span>
              <p className="mt-1.5 text-2xl font-black text-white">{overview.total_students}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                {selectedDept === "all" ? "Institution-wide" : "In selected dept"}
              </span>
            </Card>

            <Card className="border border-white/8 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Faculty
              </span>
              <p className="mt-1.5 text-2xl font-black text-cyan-300">{overview.total_faculty}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                {selectedDept === "all" ? "All faculties" : "Assigned to dept"}
              </span>
            </Card>

            <Card className="border border-white/8 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Evaluated Students
              </span>
              <p className="mt-1.5 text-2xl font-black text-indigo-400">{overview.total_predictions}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                With predictive runs
              </span>
            </Card>

            <Card className="border border-white/8 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Avg Predicted Score
              </span>
              <p className="mt-1.5 text-2xl font-black text-emerald-400">
                {overview.average_predicted_score !== null ? `${overview.average_predicted_score}%` : "No data available"}
              </p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Multi-model consensus
              </span>
            </Card>

            <Card className="border border-white/8 p-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Avg Pass Probability
              </span>
              <p className="mt-1.5 text-2xl font-black text-violet-400">
                {overview.average_pass_probability !== null
                  ? `${(overview.average_pass_probability * 100).toFixed(1)}%`
                  : "No data available"}
              </p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Deterministic threshold
              </span>
            </Card>
          </div>

          {/* Risk Distribution + Department Table */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-white/8 p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3 mb-4 flex items-center justify-between">
                <span>Risk Distribution</span>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-rose-400 font-bold">HIGH RISK</span>
                    <span className="text-white font-mono">{overview.risk_distribution.HIGH || 0}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{
                        width: `${
                          overview.total_predictions > 0
                            ? ((overview.risk_distribution.HIGH || 0) / overview.total_predictions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-amber-400 font-bold">MODERATE RISK</span>
                    <span className="text-white font-mono">{overview.risk_distribution.MODERATE || 0}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${
                          overview.total_predictions > 0
                            ? ((overview.risk_distribution.MODERATE || 0) / overview.total_predictions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-emerald-400 font-bold">LOW RISK / ON TRACK</span>
                    <span className="text-white font-mono">{overview.risk_distribution.LOW || 0}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${
                          overview.total_predictions > 0
                            ? ((overview.risk_distribution.LOW || 0) / overview.total_predictions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Department Performance Table */}
            <Card className="border border-white/8 p-6 lg:col-span-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/8 pb-3 mb-4">
                Department Analytics Breakdown
              </h2>
              <div className="max-h-72 overflow-y-auto pr-1">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2">Department</th>
                      <th className="py-2 text-center">Students</th>
                      <th className="py-2 text-center">Faculty</th>
                      <th className="py-2 text-center">Avg Score</th>
                      <th className="py-2 text-center">High Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {overview.department_performance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                          No department data available for the selected filter.
                        </td>
                      </tr>
                    ) : (
                      overview.department_performance.map((dp) => (
                        <tr key={dp.code} className="hover:bg-white/2 transition-colors">
                          <td className="py-2 font-medium text-white">{dp.department}</td>
                          <td className="py-2 text-center font-mono text-slate-300">{dp.students}</td>
                          <td className="py-2 text-center font-mono text-cyan-400">{dp.faculty}</td>
                          <td className="py-2 text-center font-mono text-emerald-400">
                            {dp.avg_score !== null ? `${dp.avg_score}%` : "No data available"}
                          </td>
                          <td className="py-2 text-center font-mono">
                            {dp.high_risk_count > 0 ? (
                              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                {dp.high_risk_count}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
