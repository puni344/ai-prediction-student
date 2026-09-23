import React, { useState, useEffect } from "react";
import {
  Calendar,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Sun,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Info,
  Clock,
} from "lucide-react";
import { AdminCalendarEntry } from "../../types";
import { adminCalendarService, systemService } from "../../services/api";

export const AdminCalendarPage: React.FC = () => {
  const [entries, setEntries] = useState<AdminCalendarEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [availableYears, setAvailableYears] = useState<number[]>([2025, 2026, 2027]);
  const [systemClock, setSystemClock] = useState<{
    timezone: string;
    local_date: string;
    local_time: string;
    day_of_week: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [activeOverrideDate, setActiveOverrideDate] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>("");

  // 1. Fetch authoritative system clock on mount
  useEffect(() => {
    const fetchSystemClock = async () => {
      try {
        const clock = await systemService.getNow();
        setSystemClock(clock);
        const yr = clock.current_year || parseInt(clock.local_date.split("-")[0], 10) || 2026;
        setCurrentYear(yr);
        setSelectedYear(yr);
        setAvailableYears([yr - 1, yr, yr + 1]);
      } catch (e) {
        console.warn("Could not fetch system clock, defaulting to 2026:", e);
      }
    };
    fetchSystemClock();
  }, []);

  // 2. Load calendar for selected year
  const loadCalendar = async (year: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminCalendarService.getCalendar(year);
      setEntries(data || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Calendarific sync unavailable. Using cached/local calendar data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar(selectedYear);
  }, [selectedYear]);

  // 3. Sync trigger handler
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const res = await adminCalendarService.syncHolidays(selectedYear);
      setSyncMessage(res.message || `Calendar synchronized successfully for ${selectedYear}.`);
      await loadCalendar(selectedYear);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Calendarific sync unavailable. Using cached/local calendar data.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Admin override handlers
  const handleSetOverride = async (date: string, collegeStatus: boolean) => {
    try {
      await adminCalendarService.setAdminOverride(
        date,
        collegeStatus,
        overrideReason || (collegeStatus ? "Institution working day by admin order" : "Institution closed by admin order")
      );
      setActiveOverrideDate(null);
      setOverrideReason("");
      await loadCalendar(selectedYear);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save institution override");
    }
  };

  const handleDeleteOverride = async (date: string) => {
    try {
      await adminCalendarService.deleteAdminOverride(date);
      await loadCalendar(selectedYear);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to remove institution override");
    }
  };

  // 5. Filter entries
  const filteredEntries = entries.filter((item) => {
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.date.includes(searchQuery);

    if (categoryFilter === "ALL") return matchesQuery;
    if (categoryFilter === "ADMIN_OVERRIDE") return matchesQuery && (item.admin_override || (item as any).locked);
    if (categoryFilter === "PUBLIC_HOLIDAY") return matchesQuery && (item.category === "PUBLIC_HOLIDAY" || item.is_public_holiday);
    if (categoryFilter === "OPTIONAL_HOLIDAY") return matchesQuery && item.category === "OPTIONAL_HOLIDAY";
    if (categoryFilter === "FESTIVAL") return matchesQuery && item.category === "FESTIVAL";
    if (categoryFilter === "OBSERVANCE") return matchesQuery && item.category === "OBSERVANCE";

    return matchesQuery && item.category?.toLowerCase() === categoryFilter.toLowerCase();
  });

  const totalEvents = entries.length;
  const publicCount = entries.filter((e) => e.category === "PUBLIC_HOLIDAY" || e.is_public_holiday).length;
  const optionalCount = entries.filter((e) => e.category === "OPTIONAL_HOLIDAY").length;
  const festivalCount = entries.filter((e) => e.category === "FESTIVAL" || e.category === "OBSERVANCE").length;
  const overrideCount = entries.filter((e) => e.admin_override || (e as any).locked).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-black/80 p-6 sm:p-8 backdrop-blur-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Authoritative Institution Calendar (Asia/Kolkata Clock)</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-white">
              Academic Calendar Management
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Verified Andhra Pradesh government holidays & Calendarific v2 enrichment. Institution-wide overrides apply across all students and lock individual overrides.
            </p>
            {systemClock && (
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>Current Time: <strong className="text-white">{systemClock.local_date} ({systemClock.day_of_week})</strong> — {systemClock.timezone}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dynamic Year selector derived from backend application clock */}
            <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedYear === yr
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {yr === currentYear ? `${yr} (Current)` : yr}
                </button>
              ))}
            </div>

            {/* Sync trigger button */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/30 hover:bg-indigo-600/50 px-4 py-2 text-xs font-bold text-indigo-200 transition-all shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Holidays Now"}</span>
            </button>
          </div>
        </div>

        {/* Sync / Error message toast */}
        {syncMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Calendar Events
          </span>
          <p className="mt-1 text-2xl font-black text-white">{totalEvents}</p>
          <span className="text-[10px] text-slate-500 block mt-0.5">Academic year {selectedYear}</span>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 backdrop-blur-md">
          <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">
            Public Holidays
          </span>
          <p className="mt-1 text-2xl font-black text-rose-400">{publicCount}</p>
          <span className="text-[10px] text-rose-300/70 block mt-0.5">College closed by default</span>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-md">
          <span className="text-[11px] font-semibold text-yellow-300 uppercase tracking-wider block">
            Optional Holidays
          </span>
          <p className="mt-1 text-2xl font-black text-yellow-400">{optionalCount}</p>
          <span className="text-[10px] text-yellow-300/70 block mt-0.5">College open by default</span>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 backdrop-blur-md">
          <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block">
            Festivals & Observances
          </span>
          <p className="mt-1 text-2xl font-black text-purple-400">{festivalCount}</p>
          <span className="text-[10px] text-purple-300/70 block mt-0.5">Informational only</span>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 backdrop-blur-md col-span-2 md:col-span-1">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">
            Admin Overrides
          </span>
          <p className="mt-1 text-2xl font-black text-amber-400">{overrideCount}</p>
          <span className="text-[10px] text-amber-300/70 block mt-0.5">Locked for all students</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search holiday name or date (YYYY-MM-DD)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Event Types</option>
            <option value="PUBLIC_HOLIDAY">Public Holidays (College Closed)</option>
            <option value="OPTIONAL_HOLIDAY">Optional Holidays</option>
            <option value="FESTIVAL">Festivals</option>
            <option value="OBSERVANCE">Observances</option>
            <option value="ADMIN_OVERRIDE">Admin / Institution Overrides</option>
          </select>
        </div>
      </div>

      {/* Calendar Entries Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Holiday / Event Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Data Source</th>
                <th className="py-3 px-4 text-center">College Status</th>
                <th className="py-3 px-4 text-center">Student Overrides</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading calendar entries for {selectedYear}...</span>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                    <p className="font-semibold text-slate-300">Calendar data not yet available for this year.</p>
                    <p className="text-xs text-slate-500 mt-1">Click "Sync Holidays Now" above to load data from Calendarific.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => {
                  const isLocked = item.locked || !!item.admin_override;
                  const source = item.source || "Calendarific";

                  return (
                    <tr key={item.date + item.name} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              <Lock className="h-3 w-3" />
                              Locked for all students
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.category === "PUBLIC_HOLIDAY" ? (
                          <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            Public Holiday
                          </span>
                        ) : item.category === "OPTIONAL_HOLIDAY" ? (
                          <span className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                            Optional Holiday
                          </span>
                        ) : item.category === "FESTIVAL" ? (
                          <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                            Festival
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-700/50 border border-slate-600/50 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                            Observance
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {source === "AP Government" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                            <ShieldCheck className="h-3 w-3" />
                            AP Government
                          </span>
                        ) : source === "Admin Manual" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                            <Lock className="h-3 w-3" />
                            Admin Manual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                            <Calendar className="h-3 w-3" />
                            Calendarific
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.admin_override ? (
                          item.admin_override.college_status ? (
                            <span className="text-emerald-400 font-bold">🏛️ Working Day</span>
                          ) : (
                            <span className="text-rose-400 font-bold">🔒 Closed (Admin)</span>
                          )
                        ) : item.is_default_no_college ? (
                          <span className="text-rose-400 font-semibold">Closed by default</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Active by default</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {item.student_override_count > 0 ? (
                          <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 font-bold text-indigo-300">
                            {item.student_override_count}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {item.admin_override ? (
                          <button
                            onClick={() => handleDeleteOverride(item.date)}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-all"
                          >
                            Remove Override
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSetOverride(item.date, false)}
                              className="rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition-all"
                            >
                              Force Holiday
                            </button>
                            <button
                              onClick={() => handleSetOverride(item.date, true)}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-all"
                            >
                              Force Working
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
