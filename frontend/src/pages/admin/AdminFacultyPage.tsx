import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Search,
  ChevronDown,
} from "lucide-react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { adminService } from "../../services/api";
import { DEPARTMENTS } from "../../constants/departments";
import { AdminFacultyItem } from "../../types";

export const AdminFacultyPage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [faculty, setFaculty] = useState<AdminFacultyItem[]>([]);
  const [facultyTotal, setFacultyTotal] = useState<number>(0);
  const [facultySearch, setFacultySearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchFaculty = async (dept: string, searchVal: string) => {
    setIsLoading(true);
    try {
      const res = await adminService.getFaculty({
        department: dept === "all" ? undefined : dept,
        search: searchVal.trim() || undefined,
        limit: 100,
      });
      setFaculty(res.faculty);
      setFacultyTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load faculty:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty(selectedDept, facultySearch);
  }, [selectedDept]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center border-b border-white/8 pb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-300">
              FACULTY MANAGEMENT
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Faculty Management
            </h1>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Manage faculty members and department assignments.
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

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by faculty name, ID, or email..."
            value={facultySearch}
            onChange={(e) => setFacultySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchFaculty(selectedDept, facultySearch);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => fetchFaculty(selectedDept, facultySearch)}
        >
          Search
        </Button>
      </div>

      {/* Faculty Directory */}
      <Card className="border border-white/8 p-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Institutional Faculty Directory
          </span>
          <span className="text-xs font-mono text-slate-500">
            Showing {faculty.length} of {facultyTotal} faculty
          </span>
        </div>

        {isLoading ? (
          <LoadingState message="Querying faculty..." />
        ) : faculty.length === 0 ? (
          <EmptyState title="No Faculty Found" description="No faculty members match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2.5">Faculty Name / Email</th>
                  <th className="py-2.5">Employee ID</th>
                  <th className="py-2.5">Designation</th>
                  <th className="py-2.5">Assigned Department(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {faculty.map((fc) => (
                  <tr key={fc.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-2.5">
                      <p className="font-bold text-white">{fc.full_name}</p>
                      <p className="text-[11px] text-slate-400">{fc.email}</p>
                    </td>
                    <td className="py-2.5 font-mono text-cyan-300 font-semibold">
                      {fc.faculty_id || "N/A"}
                    </td>
                    <td className="py-2.5 text-slate-300">{fc.designation}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {fc.assigned_departments.map((ad) => (
                          <span
                            key={ad}
                            className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300"
                          >
                            {ad}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
