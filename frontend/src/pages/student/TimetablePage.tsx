import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  BookOpen,
  Coffee,
  Moon,
  Utensils,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sun,
  Sunset,
  AlertTriangle,
  Info,
  ShieldCheck,
  CalendarCheck,
  CalendarX,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { timetableService, calendarService } from "../../services/api";
import type {
  TimetablePreferences,
  TimetableResponse,
  TimetableBlock,
  TimetableValidationResult,
  DayStatusResponse,
  CalendarBusyEvent,
  DayResolutionResponse,
} from "../../types";
import { AcademicCalendarWidget } from "./AcademicCalendarWidget";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";

const toMinutes = (timeStr: string): number => {
  const [h, m] = (timeStr || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  return (h * 60 + m) % 1440;
};

const toHHMM = (minutes: number): string => {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatTime12h = (timeStr: string): string => {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
};

const formatMinutesToHours = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const TimetablePage: React.FC = () => {
  const [dayStatus, setDayStatus] = useState<DayStatusResponse | null>(null);
  const [calendarDayStatus, setCalendarDayStatus] = useState<DayResolutionResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [holidayLabel, setHolidayLabel] = useState<string>("College Holiday");
  const [calendarConnected, setCalendarConnected] = useState<boolean>(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarBusyEvent[]>([]);

  const [preferences, setPreferences] = useState<TimetablePreferences>({
    college_start: "09:00",
    college_end: "16:00",
    daily_study_hours: 2.0,
    sleep_hours: 8.0,
    sleep_start: "23:00",
    sleep_end: "07:00",
    rest_minutes: 15,
    meal_minutes: 30,
    preferred_study_period: "evening",
    session_length_preference: "standard",
    profile_study_hours: 2.0,
    profile_sleep_hours: 8.0,
  });

  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(true);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Fetch initial day status and preferences
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const statusData = await timetableService.getDayStatus();
        setDayStatus(statusData);
        setSelectedDate(statusData.selected_date);
        setIsHoliday(statusData.is_holiday);
        setCalendarConnected(statusData.calendar_connected);
        setCalendarEvents(statusData.calendar_events || []);

        const saved = await timetableService.getPreferences(statusData.selected_date);
        const merged: TimetablePreferences = {
          ...saved,
          selected_date: statusData.selected_date,
          is_holiday: statusData.is_holiday,
          calendar_events: statusData.calendar_events,
        };
        setPreferences(merged);

        try {
          const calStatus = await calendarService.getDayStatus(statusData.selected_date);
          setCalendarDayStatus(calStatus);
          if (calStatus) {
            setIsHoliday(!calStatus.college_status);
            if (calStatus.holiday_name) setHolidayLabel(calStatus.holiday_name);
            merged.is_holiday = !calStatus.college_status;
            merged.holiday_label = calStatus.holiday_name || null;
          }
        } catch (calErr) {
          console.warn("Could not fetch initial academic calendar resolution", calErr);
        }

        const res = await timetableService.generate(merged);
        setTimetable(res);
      } catch (err: any) {
        console.error("Failed to load initial timetable", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Determine whether college is active for selected date
  const isSunday = useMemo(() => {
    if (dayStatus && dayStatus.selected_date === selectedDate) {
      return dayStatus.is_sunday;
    }
    if (!selectedDate) return false;
    const parts = selectedDate.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getDay() === 0;
  }, [dayStatus, selectedDate]);

  const collegeActive = !isSunday && !isHoliday;

  // Real-time 24-hour capacity calculation (Strict physical interval union)
  const constraintStatus = useMemo(() => {
    // 1. College
    let collegeMinutes = 0;
    const colSet = new Set<number>();
    if (collegeActive) {
      const colStartM = toMinutes(preferences.college_start);
      const colEndM = toMinutes(preferences.college_end);
      collegeMinutes = (colEndM - colStartM + 1440) % 1440;
      if (collegeMinutes === 0) {
        return {
          valid: false,
          error_type: "HARD_CONSTRAINT_CONFLICT",
          errorCode: "INVALID_COLLEGE_TIMINGS",
          message: "College start time and end time cannot be identical.",
          collegeActive: true,
          collegeMinutes: 0,
          sleepMinutes: Math.round(preferences.sleep_hours * 60),
          mealMinutes: 0,
          restMinutes: 0,
          calendarBusyMinutes: 0,
          availableMinutes: 0,
          availableStudyMinutes: 0,
          requestedStudyMinutes: Math.round(preferences.daily_study_hours * 60),
          totalMinutes: 0,
          remainingBufferMinutes: 0,
          wakeTime: "07:00",
          is_partial_preview: false,
          shortfall_minutes: 0,
        };
      }
      for (let i = 0; i < collegeMinutes; i++) {
        colSet.add((colStartM + i) % 1440);
      }
    }

    // 2. Fixed Meals
    const bStartM = toMinutes(preferences.breakfast_start || "08:00");
    const bDur = preferences.breakfast_duration || 30;
    const bSet = new Set<number>();
    for (let i = 0; i < bDur; i++) bSet.add((bStartM + i) % 1440);

    const lStartM = toMinutes(preferences.lunch_start || "12:00");
    const lDur = preferences.lunch_duration || 60;
    const lSet = new Set<number>();
    for (let i = 0; i < lDur; i++) lSet.add((lStartM + i) % 1440);

    const dStartM = toMinutes(preferences.dinner_start || "20:00");
    const dDur = preferences.dinner_duration || 30;
    const dSet = new Set<number>();
    for (let i = 0; i < dDur; i++) dSet.add((dStartM + i) % 1440);

    // 3. Incompatible fixed meal overlap
    const hasOverlap = (s1: Set<number>, s2: Set<number>) => {
      for (const m of s1) if (s2.has(m)) return true;
      return false;
    };

    if (hasOverlap(bSet, lSet) || hasOverlap(lSet, dSet) || hasOverlap(bSet, dSet)) {
      return {
        valid: false,
        error_type: "HARD_CONSTRAINT_CONFLICT",
        errorCode: "HARD_CONSTRAINT_CONFLICT",
        message: "Your fixed meal timings overlap. Please adjust your breakfast, lunch, or dinner schedule.",
        collegeActive,
        collegeMinutes,
        sleepMinutes: Math.round(preferences.sleep_hours * 60),
        mealMinutes: bDur + lDur + dDur,
        restMinutes: preferences.rest_minutes,
        calendarBusyMinutes: 0,
        availableMinutes: 0,
        availableStudyMinutes: 0,
        requestedStudyMinutes: Math.round(preferences.daily_study_hours * 60),
        totalMinutes: 0,
        remainingBufferMinutes: 0,
        wakeTime: preferences.sleep_end || "07:00",
        is_partial_preview: false,
        shortfall_minutes: 0,
      };
    }

    // 4. Calendar Busy Intervals
    const calendarBusySet = new Set<number>();
    for (const ev of calendarEvents) {
      if (ev.is_all_day) continue;
      const s = toMinutes(ev.start_time);
      const e = toMinutes(ev.end_time);
      const dur = (e - s + 1440) % 1440;
      for (let m = 0; m < dur; m++) {
        calendarBusySet.add((s + m) % 1440);
      }
    }

    // 5. Sleep: Flexible vs Explicitly Fixed
    const sleepIsFixed = Boolean(preferences.sleep_is_fixed);
    const fixedSleepMinutes = Math.round((preferences.sleep_hours || 8.0) * 60);
    const sleepStartM = toMinutes(preferences.sleep_start || "23:00");
    const fixedWakeM = (sleepStartM + fixedSleepMinutes) % 1440;
    const fixedWakeTime = toHHMM(fixedWakeM);

    const sleepSet = new Set<number>();
    if (sleepIsFixed) {
      for (let i = 0; i < fixedSleepMinutes; i++) {
        sleepSet.add((sleepStartM + i) % 1440);
      }

      if (collegeActive && hasOverlap(sleepSet, colSet)) {
        return {
          valid: false,
          error_type: "HARD_CONSTRAINT_CONFLICT",
          errorCode: "COLLEGE_SLEEP_OVERLAP",
          message: `Your fixed sleep window (${formatTime12h(preferences.sleep_start)} to ${formatTime12h(fixedWakeTime)}) overlaps with your college hours (${formatTime12h(preferences.college_start)} to ${formatTime12h(preferences.college_end)}). Please adjust your sleep timing or college schedule.`,
          collegeActive: true,
          collegeMinutes,
          sleepMinutes: fixedSleepMinutes,
          mealMinutes: bDur + lDur + dDur,
          restMinutes: preferences.rest_minutes,
          calendarBusyMinutes: calendarBusySet.size,
          availableMinutes: 0,
          availableStudyMinutes: 0,
          requestedStudyMinutes: Math.round(preferences.daily_study_hours * 60),
          totalMinutes: 0,
          remainingBufferMinutes: 0,
          wakeTime: fixedWakeTime,
          is_partial_preview: false,
          shortfall_minutes: 0,
        };
      }

      if (hasOverlap(sleepSet, bSet) || hasOverlap(sleepSet, lSet) || hasOverlap(sleepSet, dSet)) {
        return {
          valid: false,
          error_type: "HARD_CONSTRAINT_CONFLICT",
          errorCode: "HARD_CONSTRAINT_CONFLICT",
          message: `One of your fixed meals falls inside your fixed sleep window (${formatTime12h(preferences.sleep_start)} to ${formatTime12h(fixedWakeTime)}).`,
          collegeActive,
          collegeMinutes,
          sleepMinutes: fixedSleepMinutes,
          mealMinutes: bDur + lDur + dDur,
          restMinutes: preferences.rest_minutes,
          calendarBusyMinutes: calendarBusySet.size,
          availableMinutes: 0,
          availableStudyMinutes: 0,
          requestedStudyMinutes: Math.round(preferences.daily_study_hours * 60),
          totalMinutes: 0,
          remainingBufferMinutes: 0,
          wakeTime: fixedWakeTime,
          is_partial_preview: false,
          shortfall_minutes: 0,
        };
      }
    }

    // 6. Hard Occupied Union (no double-counting meals inside college!)
    const hardUnion = new Set<number>();
    if (collegeActive) {
      for (const m of colSet) hardUnion.add(m);
    }
    for (const m of bSet) hardUnion.add(m);
    for (const m of lSet) hardUnion.add(m);
    for (const m of dSet) hardUnion.add(m);
    for (const m of calendarBusySet) hardUnion.add(m);
    if (sleepIsFixed) {
      for (const m of sleepSet) hardUnion.add(m);
    }

    const hardOccupiedMinutes = hardUnion.size;
    const remainingFlexibleMinutes = Math.max(0, 1440 - hardOccupiedMinutes);

    // 7. Flexible Requirements
    const minSleepMinutes = sleepIsFixed ? 0 : Math.round((preferences.min_sleep_hours ?? preferences.sleep_hours ?? 8.0) * 60);
    const minStudyMinutes = Math.round((preferences.min_study_hours ?? preferences.daily_study_hours ?? 2.0) * 60);

    const minRequiredTotal = hardOccupiedMinutes + minSleepMinutes + minStudyMinutes;
    const availableStudyMinutes = Math.max(0, remainingFlexibleMinutes - minSleepMinutes);
    const requestedStudyMinutes = minStudyMinutes;

    if (minRequiredTotal > 1440) {
      const shortfallMinutes = minRequiredTotal - 1440;
      const shortfallH = (shortfallMinutes / 60).toFixed(1);
      const reqH = (minRequiredTotal / 60).toFixed(1);
      return {
        valid: false,
        error_type: "CAPACITY_INFEASIBILITY",
        errorCode: "DAILY_CAPACITY_EXCEEDED",
        message: `Your routine requires ${reqH} hours total, exceeding 24h capacity by ${shortfallH} hours. Showing maximum schedulable study time (${(availableStudyMinutes / 60).toFixed(1)}h).`,
        collegeActive,
        collegeMinutes,
        sleepMinutes: sleepIsFixed ? fixedSleepMinutes : minSleepMinutes,
        mealMinutes: bDur + lDur + dDur,
        restMinutes: preferences.rest_minutes,
        calendarBusyMinutes: calendarBusySet.size,
        availableMinutes: availableStudyMinutes,
        availableStudyMinutes,
        requestedStudyMinutes,
        totalMinutes: minRequiredTotal,
        remainingBufferMinutes: 0,
        wakeTime: fixedWakeTime,
        is_partial_preview: true,
        shortfall_minutes: shortfallMinutes,
      };
    }

    const remainingBufferMinutes = Math.max(0, availableStudyMinutes - requestedStudyMinutes);
    return {
      valid: true,
      error_type: null,
      errorCode: null,
      message: "Your schedule fits within 24 hours.",
      collegeActive,
      collegeMinutes,
      sleepMinutes: sleepIsFixed ? fixedSleepMinutes : minSleepMinutes,
      mealMinutes: bDur + lDur + dDur,
      restMinutes: preferences.rest_minutes,
      calendarBusyMinutes: calendarBusySet.size,
      availableMinutes: availableStudyMinutes,
      availableStudyMinutes,
      requestedStudyMinutes,
      totalMinutes: minRequiredTotal,
      remainingBufferMinutes,
      wakeTime: fixedWakeTime,
      is_partial_preview: false,
      shortfall_minutes: 0,
    };
  }, [preferences, collegeActive, calendarEvents]);

  const studyHourOptions = useMemo(() => {
    const maxH = Math.max(0, constraintStatus.availableStudyMinutes / 60);
    const options: number[] = [];
    for (let h = 0.5; h <= Math.min(maxH, 16.0); h += 0.5) {
      options.push(parseFloat(h.toFixed(1)));
    }
    if (
      preferences.daily_study_hours > 0 &&
      preferences.daily_study_hours <= maxH &&
      !options.includes(preferences.daily_study_hours)
    ) {
      options.push(preferences.daily_study_hours);
      options.sort((a, b) => a - b);
    }
    return options;
  }, [constraintStatus.availableStudyMinutes, preferences.daily_study_hours]);

  const handlePreferenceChange = <K extends keyof TimetablePreferences>(
    key: K,
    value: TimetablePreferences[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "sleep_start" || key === "sleep_hours") {
        const sM = toMinutes(next.sleep_start);
        const durM = Math.round(next.sleep_hours * 60);
        next.sleep_end = toHHMM((sM + durM) % 1440);
      }
      return next;
    });
    setApiError(null);
  };

  // Date switching
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setApiError(null);
    try {
      setGenerating(true);
      const statusData = await timetableService.getDayStatus(newDate);
      setDayStatus(statusData);
      setIsHoliday(statusData.is_holiday);
      setCalendarConnected(statusData.calendar_connected);
      setCalendarEvents(statusData.calendar_events || []);

      const nextPrefs: TimetablePreferences = {
        ...preferences,
        selected_date: newDate,
        is_holiday: statusData.is_holiday,
        calendar_events: statusData.calendar_events,
      };
      setPreferences(nextPrefs);

      const res = await timetableService.generate(nextPrefs);
      setTimetable(res);
    } catch (err: any) {
      console.error("Error switching date", err);
    } finally {
      setGenerating(false);
    }
  };

  // Quick Today button
  const handleCalendarDateChange = async (newDate: string) => {
    handleDateChange(newDate);
    try {
      const cal = await calendarService.getDayStatus(newDate);
      setCalendarDayStatus(cal);
      if (cal) {
        setIsHoliday(!cal.college_status);
        if (cal.holiday_name) setHolidayLabel(cal.holiday_name);
      }
    } catch (e) {
      console.warn("Failed to resolve calendar on date change", e);
    }
  };

  const handleCalendarStatusUpdated = (updated: DayResolutionResponse) => {
    setCalendarDayStatus(updated);
    setIsHoliday(!updated.college_status);
    if (updated.holiday_name) setHolidayLabel(updated.holiday_name);
    const updatedPrefs: TimetablePreferences = {
      ...preferences,
      is_holiday: !updated.college_status,
      holiday_label: updated.holiday_name || null,
      selected_date: selectedDate,
    };
    setPreferences(updatedPrefs);
    timetableService.generate(updatedPrefs).then(setTimetable).catch(console.error);
  };

  const handleQuickToday = () => {
    if (dayStatus?.current_date) {
      handleDateChange(dayStatus.current_date);
    }
  };

  // Toggle Holiday for selected date
  const handleToggleHoliday = async (marked: boolean) => {
    if (!selectedDate) return;
    try {
      setGenerating(true);
      await timetableService.toggleHoliday(selectedDate, marked, holidayLabel);
      setIsHoliday(marked);

      const nextPrefs: TimetablePreferences = {
        ...preferences,
        selected_date: selectedDate,
        is_holiday: marked,
        calendar_events: calendarEvents,
      };
      setPreferences(nextPrefs);

      const res = await timetableService.generate(nextPrefs);
      setTimetable(res);
    } catch (err: any) {
      console.error("Error toggling holiday", err);
      setApiError("Failed to update holiday status.");
    } finally {
      setGenerating(false);
    }
  };

  // Connect Google Calendar (Demo/Mock or Live)
  const handleConnectCalendar = async () => {
    try {
      setGenerating(true);
      // Connect demo mock events for testing / demonstration
      const mockEvents = [
        {
          date: selectedDate,
          title: "Project Meeting & Discussion",
          start_time: "17:00",
          end_time: "18:30",
          is_all_day: false,
        },
      ];
      await timetableService.connectCalendar({
        calendar_email: "student.academic@college.edu",
        mock_events: mockEvents,
      });
      setCalendarConnected(true);
      setCalendarEvents(mockEvents);

      const nextPrefs: TimetablePreferences = {
        ...preferences,
        selected_date: selectedDate,
        is_holiday: isHoliday,
        calendar_events: mockEvents,
      };
      setPreferences(nextPrefs);

      const res = await timetableService.generate(nextPrefs);
      setTimetable(res);
    } catch (err: any) {
      console.error("Error connecting calendar", err);
      setApiError("Failed to connect Google Calendar.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      setGenerating(true);
      await timetableService.disconnectCalendar();
      setCalendarConnected(false);
      setCalendarEvents([]);

      const nextPrefs: TimetablePreferences = {
        ...preferences,
        selected_date: selectedDate,
        is_holiday: isHoliday,
        calendar_events: [],
      };
      setPreferences(nextPrefs);

      const res = await timetableService.generate(nextPrefs);
      setTimetable(res);
    } catch (err: any) {
      console.error("Error disconnecting calendar", err);
    } finally {
      setGenerating(false);
    }
  };

  // Live simulation: automatically recalculate preview on preference changes
  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(async () => {
      try {
        setGenerating(true);
        const payload: TimetablePreferences = {
          ...preferences,
          selected_date: selectedDate,
          is_holiday: isHoliday,
          calendar_events: calendarEvents,
        };
        const res = await timetableService.generate(payload);
        setTimetable(res);
      } catch (err: any) {
        console.error("Live simulation error", err);
      } finally {
        setGenerating(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [preferences, selectedDate, isHoliday, calendarEvents, constraintStatus.valid, loading]);

  const handleSave = async () => {

    try {
      setGenerating(true);
      setApiError(null);
      setSavedSuccess(false);

      const payload: TimetablePreferences = {
        ...preferences,
        selected_date: selectedDate,
        is_holiday: isHoliday,
        holiday_label: holidayLabel,
        calendar_events: calendarEvents,
      };
      await timetableService.savePreferences(payload);
      const res = await timetableService.generate(payload);
      setTimetable(res);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "object" && detail?.message) {
        setApiError(detail.message);
      } else if (typeof detail === "string") {
        setApiError(detail);
      } else {
        setApiError("Failed to save timetable preferences. Please verify your schedule inputs.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "college":
        return {
          bg: "bg-blue-500/15 text-blue-300 border-blue-500/30",
          icon: <GraduationCap className="h-4 w-4 text-blue-400" />,
          label: "College",
        };
      case "study":
        return {
          bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          icon: <BookOpen className="h-4 w-4 text-emerald-400" />,
          label: "Study Focus",
        };
      case "meal":
        return {
          bg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          icon: <Utensils className="h-4 w-4 text-amber-400" />,
          label: "Meal",
        };
      case "rest":
        return {
          bg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
          icon: <Coffee className="h-4 w-4 text-purple-400" />,
          label: "Rest & Break",
        };
      case "sleep":
        return {
          bg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
          icon: <Moon className="h-4 w-4 text-indigo-400" />,
          label: "Sleep",
        };
      case "calendar":
        return {
          bg: "bg-rose-500/15 text-rose-300 border-rose-500/30",
          icon: <CalendarCheck className="h-4 w-4 text-rose-400" />,
          label: "Calendar Event",
        };
      default:
        return {
          bg: "bg-slate-500/15 text-slate-300 border-slate-500/30",
          icon: <Clock className="h-4 w-4 text-slate-400" />,
          label: "Routine",
        };
    }
  };

  const colPct = Math.min(100, (constraintStatus.collegeMinutes / 1440) * 100);
  const sleepPct = Math.min(100, (constraintStatus.sleepMinutes / 1440) * 100);
  const studyPct = Math.min(100, (constraintStatus.requestedStudyMinutes / 1440) * 100);
  const mealPct = Math.min(100, (constraintStatus.mealMinutes / 1440) * 100);
  const restPct = Math.min(100, (constraintStatus.restMinutes / 1440) * 100);
  const calPct = Math.min(100, (constraintStatus.calendarBusyMinutes / 1440) * 100);
  const bufferPct = Math.max(0, (constraintStatus.remainingBufferMinutes / 1440) * 100);

  // Format date display (e.g., "Sunday, 20 September 2026")
  const formattedDateTitle = useMemo(() => {
    if (!selectedDate) return "Today";
    try {
      const parts = selectedDate.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="space-y-8 pb-16">
      {/* Date-Aware Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-6 w-6 text-brand-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">My Study Timetable</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="text-slate-200 font-medium">{formattedDateTitle}</span>
            <span className="text-slate-600">•</span>
            <span>Timezone: {dayStatus?.timezone || "Asia/Kolkata"}</span>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Today & Tomorrow Only Toggle */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={handleQuickToday}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedDate === (dayStatus?.current_date || new Date().toISOString().split("T")[0])
                  ? "bg-indigo-600 text-white shadow-sm"
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
                handleDateChange(`${yr}-${mo}-${da}`);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedDate !== (dayStatus?.current_date || new Date().toISOString().split("T")[0])
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tomorrow
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
          >
            <Sliders className="h-4 w-4 mr-1.5 text-brand-400" />
            {showConfig ? "Hide Config" : "Edit Preferences"}
          </Button>

          {timetable && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={generating || !constraintStatus.valid}
              className="bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Save Timetable
            </Button>
          )}
        </div>
      </div>

      {/* Prediction Staleness Banner */}
      {dayStatus?.prediction_is_stale && (
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold">Academic Profile Has Changed</p>
              <p className="text-xs text-amber-300/80">
                {dayStatus.prediction_stale_reason ||
                  "Your study or sleep hours were modified. Run a new prediction to update your academic risk and SHAP results."}
              </p>
            </div>
          </div>
          <Link to="/student/prediction">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs">
              Run New Prediction
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Production Academic Calendar & Holiday-Aware Day Resolution Engine */}
      <AcademicCalendarWidget
        dayStatus={calendarDayStatus}
        selectedDate={selectedDate}
        onDateChange={handleCalendarDateChange}
        onStatusUpdated={handleCalendarStatusUpdated}
      />

      {/* Day Status & Holiday Selector Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Card */}
        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Day Classification</p>
            <p className="text-base font-bold text-white mt-0.5">
              {isSunday ? (
                <span className="text-emerald-400">Sunday — No College</span>
              ) : isHoliday ? (
                <span className="text-amber-400">Holiday — No College</span>
              ) : (
                <span className="text-blue-400">College Day</span>
              )}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            {isSunday ? (
              <Sun className="h-5 w-5 text-emerald-400" />
            ) : isHoliday ? (
              <CalendarX className="h-5 w-5 text-amber-400" />
            ) : (
              <GraduationCap className="h-5 w-5 text-blue-400" />
            )}
          </div>
        </Card>

        {/* Weekday Holiday Toggle */}
        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Holiday Override</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSunday ? "Sundays are non-college by default" : "Mark this date as college holiday"}
            </p>
          </div>
          {!isSunday ? (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => handleToggleHoliday(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  !isHoliday
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                College Day
              </button>
              <button
                onClick={() => handleToggleHoliday(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  isHoliday
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Holiday
              </button>
            </div>
          ) : (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              Free Day
            </span>
          )}
        </Card>

        </div>

      {/* Error & Success Messages */}
      {apiError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-200">Timetable Feasibility Conflict</p>
            <p className="text-xs mt-0.5 text-rose-300/90">{apiError}</p>
          </div>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-200">Timetable Preferences Saved</p>
            <p className="text-xs text-emerald-300/80">
              Preferences synchronized with your profile and saved for {formattedDateTitle}.
            </p>
          </div>
        </div>
      )}

      {/* Real-Time 24-Hour Daily Capacity Breakdown */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-400" />
              Daily 24-Hour Time Capacity
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSunday
                ? "Sunday: College hours are removed. Available study capacity expands across the day."
                : isHoliday
                ? "Holiday: College hours are removed for this date."
                : "Normal College Day: 09:00 - 16:00 college block is active."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {constraintStatus.valid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Schedule fits within 24 hours
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <AlertCircle className="h-3.5 w-3.5" />
                Capacity Exceeded
              </span>
            )}
          </div>
        </div>

        {/* Stacked 24-Hour Progress Bar */}
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
          {collegeActive && (
            <div
              style={{ width: `${colPct}%` }}
              className="h-full bg-blue-500"
              title={`College: ${formatMinutesToHours(constraintStatus.collegeMinutes)}`}
            />
          )}
          <div
            style={{ width: `${sleepPct}%` }}
            className="h-full bg-indigo-500"
            title={`Sleep: ${formatMinutesToHours(constraintStatus.sleepMinutes)}`}
          />
          <div
            style={{ width: `${studyPct}%` }}
            className="h-full bg-emerald-500"
            title={`Study: ${formatMinutesToHours(constraintStatus.requestedStudyMinutes)}`}
          />
          <div
            style={{ width: `${mealPct}%` }}
            className="h-full bg-amber-500"
            title={`Meals: ${formatMinutesToHours(constraintStatus.mealMinutes)}`}
          />
          <div
            style={{ width: `${restPct}%` }}
            className="h-full bg-purple-500"
            title={`Rest: ${formatMinutesToHours(constraintStatus.restMinutes)}`}
          />
          {calPct > 0 && (
            <div
              style={{ width: `${calPct}%` }}
              className="h-full bg-rose-500"
              title={`Calendar Busy: ${formatMinutesToHours(constraintStatus.calendarBusyMinutes)}`}
            />
          )}
          <div
            style={{ width: `${bufferPct}%` }}
            className="h-full bg-slate-800"
            title={`Remaining Buffer: ${formatMinutesToHours(constraintStatus.remainingBufferMinutes)}`}
          />
        </div>

        {/* Time Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 pt-2">
          {collegeActive ? (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-[11px] text-blue-300 font-medium">College</p>
              <p className="text-base font-bold text-white mt-0.5">
                {formatMinutesToHours(constraintStatus.collegeMinutes)}
              </p>
              <p className="text-[10px] text-blue-400 mt-0.5">
                {preferences.college_start} - {preferences.college_end}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
              <p className="text-[11px] text-slate-400 font-medium">College</p>
              <p className="text-base font-bold text-slate-400 mt-0.5">0h</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">Not Scheduled</p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-[11px] text-indigo-300 font-medium">Sleep</p>
            <p className="text-base font-bold text-white mt-0.5">
              {formatMinutesToHours(constraintStatus.sleepMinutes)}
            </p>
            <p className="text-[10px] text-indigo-400 mt-0.5">
              {preferences.sleep_start} - {constraintStatus.wakeTime}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[11px] text-emerald-300 font-medium">Study Target</p>
            <p className="text-base font-bold text-white mt-0.5">
              {formatMinutesToHours(constraintStatus.requestedStudyMinutes)}
            </p>
            <p className="text-[10px] text-emerald-400 mt-0.5">
              Max: {formatMinutesToHours(constraintStatus.availableStudyMinutes)}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[11px] text-amber-300 font-medium">Meals</p>
            <p className="text-base font-bold text-white mt-0.5">{preferences.meal_minutes}m</p>
            <p className="text-[10px] text-amber-400 mt-0.5">Per Session</p>
          </div>

          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-[11px] text-purple-300 font-medium">Rest & Breaks</p>
            <p className="text-base font-bold text-white mt-0.5">{preferences.rest_minutes}m</p>
            <p className="text-[10px] text-purple-400 mt-0.5">Between Sessions</p>
          </div>

          

          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <p className="text-[11px] text-slate-300 font-medium">Remaining Buffer</p>
            <p className="text-base font-bold text-white mt-0.5">
              {formatMinutesToHours(constraintStatus.remainingBufferMinutes)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Free Flex Time</p>
          </div>
        </div>
      </Card>

      {/* Preferences Configuration Editor */}
      {showConfig && (
        <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Personal Routine & Constraints</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every change triggers an instant live simulation preview below.
              </p>
            </div>
            {generating && (
              <span className="text-xs text-brand-400 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Live Recalculating...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Daily Study Hours */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Daily Study Hours Target</span>
                <span className="text-[11px] text-brand-400 font-semibold">
                  {preferences.daily_study_hours} Hours
                </span>
              </label>
              <select
                value={preferences.daily_study_hours}
                onChange={(e) => handlePreferenceChange("daily_study_hours", parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              >
                {studyHourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "Hour" : "Hours"}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Max available for {isSunday || isHoliday ? "today" : "college day"}:{" "}
                {(constraintStatus.availableStudyMinutes / 60).toFixed(1)}h
              </p>
            </div>

            {/* Sleep Mode: Flexible vs Fixed */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Sleep Constraint Mode</span>
                <span className="text-[11px] text-indigo-400 font-semibold">
                  {preferences.sleep_is_fixed ? "Fixed Bedtime" : "Flexible (Optimized)"}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePreferenceChange("sleep_is_fixed", false)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    !preferences.sleep_is_fixed
                      ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  Flexible Sleep
                </button>
                <button
                  type="button"
                  onClick={() => handlePreferenceChange("sleep_is_fixed", true)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    preferences.sleep_is_fixed
                      ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  Fixed Sleep
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                {!preferences.sleep_is_fixed
                  ? "Sleep is flexible: allocated between bounds and scheduled safely around college and meals."
                  : "Enforces exact bedtime and wake-up as an immovable hard constraint."}
              </p>
            </div>

            {/* Sleep Hours */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Daily Sleep Duration</span>
                <span className="text-[11px] text-indigo-400 font-semibold">
                  {preferences.sleep_hours} Hours
                </span>
              </label>
              <select
                value={preferences.sleep_hours}
                onChange={(e) => handlePreferenceChange("sleep_hours", parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              >
                {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((h) => (
                  <option key={h} value={h}>
                    {h} Hours
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Wake-up time calculated as {constraintStatus.wakeTime}
              </p>
            </div>

            {/* Sleep Start Time */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Sleep Start Time</label>
              <input
                type="time"
                value={preferences.sleep_start}
                onChange={(e) => handlePreferenceChange("sleep_start", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              />
              <p className="text-[11px] text-slate-500">Normal bedtime</p>
            </div>

            {/* College Start & End (Disabled if Sunday or Holiday) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>College Start Time</span>
                {!collegeActive && <span className="text-[10px] text-amber-400">Not active today</span>}
              </label>
              <input
                type="time"
                disabled={!collegeActive}
                value={preferences.college_start}
                onChange={(e) => handlePreferenceChange("college_start", e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 ${
                  !collegeActive ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              <p className="text-[11px] text-slate-500">Scheduled arrival at college</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>College End Time</span>
                {!collegeActive && <span className="text-[10px] text-amber-400">Not active today</span>}
              </label>
              <input
                type="time"
                disabled={!collegeActive}
                value={preferences.college_end}
                onChange={(e) => handlePreferenceChange("college_end", e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 ${
                  !collegeActive ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              <p className="text-[11px] text-slate-500">Departure after classes & labs</p>
            </div>

            {/* Preferred Study Period */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Preferred Study Window</label>
              <select
                value={preferences.preferred_study_period}
                onChange={(e) => handlePreferenceChange("preferred_study_period", e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              >
                <option value="morning">Morning (Early Focus)</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening (Post-College / Dinner)</option>
                <option value="night">Night (Deep Focus)</option>
                <option value="flexible">Flexible (Distributed)</option>
              </select>
              <p className="text-[11px] text-slate-500">Planner prioritizes study in this window</p>
            </div>

            {/* Breakfast (User-Defined Constraint, Default: 08:00–08:30) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Breakfast Start & Duration</span>
                <span className="text-[11px] text-amber-400 font-semibold">
                  {preferences.breakfast_start || "08:00"} ({preferences.breakfast_duration || 30}m)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={preferences.breakfast_start || "08:00"}
                  onChange={(e) => handlePreferenceChange("breakfast_start", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                />
                <select
                  value={preferences.breakfast_duration || 30}
                  onChange={(e) => handlePreferenceChange("breakfast_duration", parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                >
                  <option value={15}>15 mins</option>
                  <option value={20}>20 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">Fixed morning meal constraint</p>
            </div>

            {/* Lunch (User-Defined Constraint, Default: 12:00–13:00) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Lunch Start & Duration</span>
                <span className="text-[11px] text-amber-400 font-semibold">
                  {preferences.lunch_start || "12:00"} ({preferences.lunch_duration || 60}m)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={preferences.lunch_start || "12:00"}
                  onChange={(e) => handlePreferenceChange("lunch_start", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                />
                <select
                  value={preferences.lunch_duration || 60}
                  onChange={(e) => handlePreferenceChange("lunch_duration", parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                >
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                  <option value={75}>75 mins</option>
                  <option value={90}>90 mins</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">Fixed midday meal / college break</p>
            </div>

            {/* Dinner (User-Defined Constraint, Default: 20:00–20:30) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Dinner Start & Duration</span>
                <span className="text-[11px] text-amber-400 font-semibold">
                  {preferences.dinner_start || "20:00"} ({preferences.dinner_duration || 30}m)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={preferences.dinner_start || "20:00"}
                  onChange={(e) => handlePreferenceChange("dinner_start", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                />
                <select
                  value={preferences.dinner_duration || 30}
                  onChange={(e) => handlePreferenceChange("dinner_duration", parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                >
                  <option value={20}>20 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">Fixed evening meal constraint</p>
            </div>
          </div>
        </Card>
      )}

            {/* Explicit Infeasibility & Conflict Banners */}
      {timetable?.validation?.error_type === "HARD_CONSTRAINT_CONFLICT" && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-rose-200 text-sm space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>Fixed Schedule Conflict</span>
          </div>
          <p className="text-xs text-rose-200/90 leading-relaxed">
            {timetable.validation.message}
          </p>
          <p className="text-[11px] text-rose-300/70 pt-1">
            Please adjust your fixed routine timings (e.g. sleep duration, meal times, or college schedule) to resolve this conflict.
          </p>
        </div>
      )}

      {timetable?.validation?.is_partial_preview && (
        <div className="p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-amber-200 text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <span>Requested Study Target Cannot Be Fully Scheduled</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {timetable.validation.message}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-2">
              <span className="text-[10px] uppercase text-amber-400 font-bold block">Required Study</span>
              <span className="text-sm font-black text-white">{((timetable.validation.requested_study_minutes ?? 0) / 60).toFixed(1)}h</span>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-2">
              <span className="text-[10px] uppercase text-amber-400 font-bold block">Available Capacity</span>
              <span className="text-sm font-black text-emerald-400">{((timetable.validation.available_study_minutes ?? 0) / 60).toFixed(1)}h</span>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-2">
              <span className="text-[10px] uppercase text-rose-400 font-bold block">Shortfall</span>
              <span className="text-sm font-black text-rose-400">{((timetable.validation.shortfall_minutes ?? 0) / 60).toFixed(1)}h</span>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-2">
              <span className="text-[10px] uppercase text-amber-400 font-bold block">Status</span>
              <span className="text-xs font-semibold text-amber-300">Partial Preview</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Generated Timetable Schedule Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-400" />
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Generated Daily Schedule — {formattedDateTitle}</span>
                {timetable?.validation?.is_partial_preview && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Partial Preview: Max Schedulable Study
                  </span>
                )}
              </h2>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {timetable?.schedule ? timetable.schedule.length : 0} scheduled time blocks
          </span>
        </div>

        {timetable && timetable.schedule.length > 0 ? (
          <div className="space-y-2.5">
            {timetable.schedule.map((block, index) => {
              const badge = getCategoryBadge(block.category);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Time Window */}
                    <div className="w-32 text-xs font-mono text-slate-300 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>
                        {formatTime12h(block.start_time)} - {formatTime12h(block.end_time)}
                      </span>
                    </div>

                    {/* Activity Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
                          {block.activity}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.bg}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      </div>
                      {block.focus_area && block.focus_area !== "College" && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Topic: <span className="text-brand-400 font-medium">{block.focus_area}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <span className="text-xs text-slate-400 font-mono">
                    {block.duration_minutes} mins
                  </span>
                </div>
              );
            })}
          </div>
        ) : timetable?.validation?.error_type === "HARD_CONSTRAINT_CONFLICT" ? (
          <Card className="p-8 text-center bg-slate-900/40 border-rose-500/30">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm text-rose-200 font-bold">Fixed Schedule Conflict</p>
            <p className="text-xs text-rose-300/80 mt-1 max-w-md mx-auto">
              {timetable.validation.message || "Your fixed constraints collide. Please adjust your sleep, meal, or college timings."}
            </p>
          </Card>
        ) : apiError ? (
          <Card className="p-8 text-center bg-slate-900/40 border-rose-500/30">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm text-rose-200 font-bold">Schedule Generation Failed</p>
            <p className="text-xs text-rose-300/80 mt-1 max-w-md mx-auto">{apiError}</p>
          </Card>
        ) : (
          <Card className="p-8 text-center bg-slate-900/40 border-slate-800">
            <RefreshCw className="h-8 w-8 text-brand-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium">Generating Timetable...</p>
            <p className="text-xs text-slate-500 mt-1">
              Calculating your schedule based on your routine constraints.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
