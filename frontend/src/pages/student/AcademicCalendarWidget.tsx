import React, { useState } from "react";
import {
  Calendar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Bookmark,
  RotateCcw,
  Sun,
  Info,
  Clock,
  ChevronRight,
} from "lucide-react";
import { DayResolutionResponse } from "../../types";
import { calendarService } from "../../services/api";

interface AcademicCalendarWidgetProps {
  dayStatus: DayResolutionResponse | null;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onStatusUpdated: (updatedStatus: DayResolutionResponse) => void;
  isLoading?: boolean;
}

export const AcademicCalendarWidget: React.FC<AcademicCalendarWidgetProps> = ({
  dayStatus,
  selectedDate,
  onDateChange,
  onStatusUpdated,
  isLoading = false,
}) => {
  const [isUpdatingOverride, setIsUpdatingOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const handleQuickDate = (date: string) => {
    onDateChange(date);
  };

  const handleApplyOverride = async (collegeStatus: boolean, reason?: string) => {
    if (!selectedDate) return;
    setIsUpdatingOverride(true);
    try {
      await calendarService.setStudentOverride(
        selectedDate,
        collegeStatus,
        reason || (collegeStatus ? "Attending college / special classes" : "Marked as personal holiday")
      );
      // Fetch fresh day status
      const updated = await calendarService.getDayStatus(selectedDate);
      onStatusUpdated(updated);
      setShowReasonInput(false);
      setOverrideReason("");
      setPendingStatus(null);
    } catch (err) {
      console.error("Failed to update student override:", err);
    } finally {
      setIsUpdatingOverride(false);
    }
  };

  const handleRevertOverride = async () => {
    if (!selectedDate) return;
    setIsUpdatingOverride(true);
    try {
      await calendarService.deleteStudentOverride(selectedDate);
      const updated = await calendarService.getDayStatus(selectedDate);
      onStatusUpdated(updated);
    } catch (err) {
      console.error("Failed to revert student override:", err);
    } finally {
      setIsUpdatingOverride(false);
    }
  };

  // Determine badge and banner appearance
  const renderStatusBanner = () => {
    if (!dayStatus) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md animate-pulse">
          <Calendar className="h-5 w-5 text-indigo-400" />
          <span className="text-sm text-slate-300">Resolving academic calendar status...</span>
        </div>
      );
    }

    if (dayStatus.admin_override || dayStatus.locked) {
      return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-200">
                  {dayStatus.college_status ? "🏛️ Institution Working Day" : "🔒 Institution Holiday"}
                </span>
                <span className="rounded-md border border-amber-500/50 bg-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Declared by your institution
                </span>
              </div>
              <p className="mt-0.5 text-xs text-amber-300/90 font-medium">
                🔒 This date is locked by your institution. Cannot be changed.
              </p>
              {dayStatus.admin_override_reason && (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Reason: {dayStatus.admin_override_reason}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-amber-400">Locked for all students</span>
          </div>
        </div>
      );
    }

    if (dayStatus.student_override) {
      return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-indigo-200">
                  {dayStatus.college_status ? "📚 Attending College (Personal Choice)" : "📌 Personal Holiday"}
                </span>
                <span className="rounded-md border border-indigo-500/40 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                  Personal Override
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                {dayStatus.student_override_reason || (dayStatus.college_status ? "You marked classes as active today." : "You marked this date as a holiday. This does not affect other students.")}
              </p>
            </div>
          </div>
          <button
            onClick={handleRevertOverride}
            disabled={isUpdatingOverride}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Revert to System Calendar</span>
          </button>
        </div>
      );
    }

    if (dayStatus.holiday) {
      if (dayStatus.is_optional_holiday) {
        return (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent p-4 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                <Sun className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-yellow-200">
                    🟡 Optional Holiday — {dayStatus.holiday_name}
                  </span>
                  <span className="rounded-md border border-yellow-500/40 bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                    College Active by Default
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Source: {dayStatus.holiday_source === "AP_GOVERNMENT" ? "AP Government Official (G.O. Rt. 2276)" : "Holiday API"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyOverride(false, `Taking optional holiday: ${dayStatus.holiday_name}`)}
                disabled={isUpdatingOverride}
                className="rounded-xl border border-yellow-500/40 bg-yellow-500/20 hover:bg-yellow-500/30 px-3.5 py-1.5 text-xs font-bold text-yellow-200 transition-all shadow-xs"
              >
                Mark as Holiday
              </button>
            </div>
          </div>
        );
      }

      // Public Holiday
      return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-rose-200">
                  🔴 Holiday Detected — {dayStatus.holiday_name}
                </span>
                <span className="rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                  No College
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Source: {dayStatus.holiday_source === "AP_GOVERNMENT" ? "Official AP Government Calendar" : "Holiday API (IN-AP)"}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleApplyOverride(true, `Classes held despite holiday: ${dayStatus.holiday_name}`)}
            disabled={isUpdatingOverride}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 hover:bg-emerald-500/30 px-3.5 py-1.5 text-xs font-bold text-emerald-200 transition-all shadow-xs"
          >
            I HAVE COLLEGE TODAY
          </button>
        </div>
      );
    }

    if (dayStatus.final_status === "SUNDAY_OFF") {
      return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-orange-200">
                  🟠 Sunday — Weekly Off
                </span>
                <span className="rounded-md border border-orange-500/40 bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                  Weekend
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                No standard college schedule. Full 24 hours available for study, rest, and routine.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleApplyOverride(true, "Sunday extra classes / lab work")}
            disabled={isUpdatingOverride}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition-all"
          >
            I Have College Today
          </button>
        </div>
      );
    }

    // Normal College Day
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent p-4 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-200">
                🟢 Normal College Day
              </span>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Classes Scheduled
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              {dayStatus.day_of_week} ? Standard college attendance hours are reserved in the 24-hour timetable.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleApplyOverride(false, "Personal leave / college closed")}
          disabled={isUpdatingOverride}
          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all"
        >
          Mark as Holiday
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Date Bar & Restricted Selector (Today & Tomorrow Only) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#0f1422]/80 p-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Date</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {selectedDate === todayStr ? "Today" : "Tomorrow"} ({selectedDate})
              </span>
              {dayStatus && (
                <span className="text-xs font-medium text-indigo-300">
                  · {dayStatus.day_of_week}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Date Selector: Strictly Today & Tomorrow Only */}
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/8">
          <button
            type="button"
            onClick={() => handleQuickDate(todayStr)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedDate === todayStr
                ? "border border-indigo-500/40 bg-indigo-500/20 text-indigo-200 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, "0");
              const da = String(d.getDate()).padStart(2, "0");
              handleQuickDate(`${yr}-${mo}-${da}`);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedDate !== todayStr
                ? "border border-indigo-500/40 bg-indigo-500/20 text-indigo-200 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Main Resolution Status Banner */}
      {renderStatusBanner()}
    </div>
  );
};
