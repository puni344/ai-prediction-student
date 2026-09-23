import React, { useState, useEffect } from "react";
import {
  User,
  BookOpen,
  Calendar,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle2,
  Save,
  HelpCircle,
  Moon,
  Utensils,
  Coffee,
  Sun,
  ShieldAlert,
} from "lucide-react";
import { studentService, timetableService } from "../../services/api";
import { StudentProfile, TimetableValidationResult } from "../../types";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { ProgramSelector } from "../../components/common/ProgramSelector";
import { DepartmentSelector } from "../../components/common/DepartmentSelector";
import { AcademicYearSelector } from "../../components/common/AcademicYearSelector";
import { getProgramByNameOrId } from "../../constants/programs";

export const StudentProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  // Unentered fields default to empty string so user sees clean placeholders
  const [stringForm, setStringForm] = useState<Record<string, string>>({
    attendance: "",
    study_hours: "",
    sleep_hours: "",
    college_start: "09:00",
    college_end: "16:00",
    breakfast_start: "08:00",
    breakfast_duration: "30",
    lunch_start: "13:00",
    lunch_duration: "30",
    dinner_start: "20:00",
    dinner_duration: "30",
    break_reserve_minutes: "120",
    assignments_completed: "",
    previous_grade: "",
    participation: "",
    age: "",
    gender: "",
    parent_education: "",
    internet_access: "",
    family_income: "",
    extra_classes: "",
  });

  const [program, setProgram] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [academicYear, setAcademicYear] = useState<string>("");
  const [yearNotice, setYearNotice] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative real-time 24h constraint validation
  const [validationResult, setValidationResult] = useState<TimetableValidationResult | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await studentService.getProfile();
        setProfile(data);
        setProgram(data.program || "");
        setDepartment(data.department || "");
        setAcademicYear(data.academic_year || "");

        setStringForm({
          attendance: data.attendance !== undefined && data.attendance !== null && data.attendance > 0 ? String(data.attendance) : "",
          study_hours: data.study_hours !== undefined && data.study_hours !== null ? String(data.study_hours) : "",
          sleep_hours: data.sleep_hours !== undefined && data.sleep_hours !== null ? String(data.sleep_hours) : "",
          college_start: data.college_start || "09:00",
          college_end: data.college_end || "16:00",
          breakfast_start: data.breakfast_start || "08:00",
          breakfast_duration: String(data.breakfast_duration || 30),
          lunch_start: data.lunch_start || "13:00",
          lunch_duration: String(data.lunch_duration || 30),
          dinner_start: data.dinner_start || "20:00",
          dinner_duration: String(data.dinner_duration || 30),
          break_reserve_minutes: String(data.break_reserve_minutes || 120),
          assignments_completed: data.assignments_completed !== undefined && data.assignments_completed !== null && data.assignments_completed > 0 ? String(data.assignments_completed) : "",
          previous_grade: data.previous_grade !== undefined && data.previous_grade !== null && data.previous_grade > 0 ? String(data.previous_grade) : "",
          participation: data.participation !== undefined && data.participation !== null && data.participation > 0 ? String(data.participation) : "",
          age: data.age !== undefined && data.age !== null ? String(data.age) : "",
          gender: data.gender || "",
          parent_education: data.parent_education || "",
          internet_access: data.internet_access || "",
          family_income: data.family_income || "",
          extra_classes: data.extra_classes || "",
        });
      } catch (err) {
        setErrorMessage("Failed to load academic profile.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // Real-time authoritative 24h capacity validation
  useEffect(() => {
    let isMounted = true;
    const runValidation = async () => {
      try {
        const breakMins = parseInt(stringForm.break_reserve_minutes) || 120;
        const res = await timetableService.validate({
          college_start: stringForm.college_start || "09:00",
          college_end: stringForm.college_end || "16:00",
          breakfast_start: stringForm.breakfast_start || "08:00",
          breakfast_duration: parseInt(stringForm.breakfast_duration) || 30,
          lunch_start: stringForm.lunch_start || "13:00",
          lunch_duration: parseInt(stringForm.lunch_duration) || 30,
          dinner_start: stringForm.dinner_start || "20:00",
          dinner_duration: parseInt(stringForm.dinner_duration) || 30,
          break_reserve_minutes: breakMins,
          daily_study_hours: parseFloat(stringForm.study_hours) || 0,
          sleep_hours: parseFloat(stringForm.sleep_hours) || 0,
          rest_minutes: 15,
          meal_minutes: 30,
          sleep_start: "23:00",
          sleep_end: "07:00",
          preferred_study_period: "evening",
          session_length_preference: "standard",
        });
        if (isMounted) {
          setValidationResult(res);
        }
      } catch (err) {
        console.warn("Real-time profile routine validation failed:", err);
      }
    };

    const timer = setTimeout(runValidation, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    stringForm.college_start,
    stringForm.college_end,
    stringForm.breakfast_start,
    stringForm.breakfast_duration,
    stringForm.lunch_start,
    stringForm.lunch_duration,
    stringForm.dinner_start,
    stringForm.dinner_duration,
    stringForm.break_reserve_minutes,
    stringForm.study_hours,
    stringForm.sleep_hours,
  ]);

  const handleProgramChange = (newProgramId: string) => {
    setProgram(newProgramId);
    setYearNotice(null);
    if (academicYear) {
      const pObj = getProgramByNameOrId(newProgramId);
      if (pObj) {
        const yrNum = parseInt(academicYear.replace(/\D/g, ""), 10);
        if (!isNaN(yrNum) && yrNum > pObj.durationYears) {
          setAcademicYear("");
          setYearNotice(
            `Selected program "${pObj.name}" is only ${pObj.durationYears} year(s). Please reselect your current year.`
          );
        }
      }
    }
  };

  const validateRanges = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (stringForm.attendance !== "") {
      const v = parseFloat(stringForm.attendance);
      if (isNaN(v) || v < 0 || v > 100) errs.attendance = "Attendance must be between 0% and 100%.";
    }
    if (stringForm.assignments_completed !== "") {
      const v = parseFloat(stringForm.assignments_completed);
      if (isNaN(v) || v < 0 || v > 100) errs.assignments_completed = "Assignments completed must be between 0% and 100%.";
    }
    if (stringForm.previous_grade !== "") {
      const v = parseFloat(stringForm.previous_grade);
      if (isNaN(v) || v < 0 || v > 100) errs.previous_grade = "Previous grade must be between 0% and 100%.";
    }
    if (stringForm.participation !== "") {
      const v = parseFloat(stringForm.participation);
      if (isNaN(v) || v < 0 || v > 100) errs.participation = "Participation must be between 0% and 100%.";
    }
    if (stringForm.study_hours !== "") {
      const v = parseFloat(stringForm.study_hours);
      if (isNaN(v) || v < 0.5 || v > 16) errs.study_hours = "Study hours must be between 0.5h and 16h.";
    }
    if (stringForm.sleep_hours !== "") {
      const v = parseFloat(stringForm.sleep_hours);
      if (isNaN(v) || v < 4 || v > 14) errs.sleep_hours = "Sleep hours must be between 4h and 14h.";
    }
    if (stringForm.age !== "") {
      const v = parseInt(stringForm.age, 10);
      if (isNaN(v) || v < 15 || v > 80) errs.age = "Age must be between 15 and 80.";
    }

    if (validationResult && !validationResult.valid) {
      errs.routine = validationResult.message;
    }

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const rangeErrs = validateRanges();
    if (Object.keys(rangeErrs).length > 0) {
      setFieldErrors(rangeErrs);
      setErrorMessage("Please correct all validation errors before saving.");
      return;
    }

    setIsSaving(true);

    const breakMins = parseInt(stringForm.break_reserve_minutes) || 120;

    const payload: Partial<StudentProfile> = {
      program: program || undefined,
      department: department || undefined,
      academic_year: academicYear || undefined,
      college_start: stringForm.college_start || "09:00",
      college_end: stringForm.college_end || "16:00",
      breakfast_start: stringForm.breakfast_start || "08:00",
      breakfast_duration: parseInt(stringForm.breakfast_duration) || 30,
      lunch_start: stringForm.lunch_start || "13:00",
      lunch_duration: parseInt(stringForm.lunch_duration) || 30,
      dinner_start: stringForm.dinner_start || "20:00",
      dinner_duration: parseInt(stringForm.dinner_duration) || 30,
      break_reserve_minutes: breakMins,
      attendance: stringForm.attendance === "" ? 0 : parseFloat(stringForm.attendance) || 0,
      study_hours: stringForm.study_hours === "" ? 0 : parseFloat(stringForm.study_hours) || 0,
      sleep_hours: stringForm.sleep_hours === "" ? 0 : parseFloat(stringForm.sleep_hours) || 0,
      assignments_completed: stringForm.assignments_completed === "" ? 0 : parseFloat(stringForm.assignments_completed) || 0,
      previous_grade: stringForm.previous_grade === "" ? 0 : parseFloat(stringForm.previous_grade) || 0,
      participation: stringForm.participation === "" ? 0 : parseFloat(stringForm.participation) || 0,
      age: stringForm.age === "" ? 20 : parseInt(stringForm.age, 10) || 20,
      gender: stringForm.gender || "Female",
      parent_education: stringForm.parent_education || "Bachelor's",
      internet_access: stringForm.internet_access || "yes",
      family_income: stringForm.family_income || "medium",
      extra_classes: stringForm.extra_classes || "no",
    };

    try {
      const updated = await studentService.updateProfile(payload);
      setProfile(updated);
      setFieldErrors({});
      setSuccessMessage(
        "Profile & daily routine saved successfully! Automatic simulation ran and latest outcome is updated."
      );
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.detail || "Failed to update profile. Please verify constraints."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Profile & Attributes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your academic identity, canonical daily routine, and behavioral indicators. Shared across Timetable and Predictive ML.
        </p>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Academic Program & Department */}
        <Card>
          <div className="flex items-center gap-2.5 border-b border-white/8 pb-3">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Academic Details</h2>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Enrolled Program
              </label>
              <ProgramSelector
                value={program}
                onChange={handleProgramChange}
                error={fieldErrors.program}
              />
            </div>

            <div>
              <DepartmentSelector
                value={department}
                onChange={(dept) => setDepartment(dept)}
                error={fieldErrors.department}
                hideLabel={false}
              />
            </div>

            <div>
              <AcademicYearSelector
                value={academicYear}
                programId={program}
                onChange={(yr) => setAcademicYear(yr)}
                error={fieldErrors.academic_year}
                disabled={!program}
                hideLabel={false}
              />
            </div>
          </div>

          {yearNotice && (
            <p className="mt-3 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              {yearNotice}
            </p>
          )}
        </Card>

        {/* Daily Routine & College Schedule */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Daily Routine & College Constraints</h2>
            </div>
            <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              Shared Timetable & Profile Routine
            </span>
          </div>

          {/* Dynamic 24h Capacity & Range Notification */}
          {validationResult && (
            <div
              className={`rounded-xl border p-4 text-xs ${
                validationResult.valid
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                  : validationResult.error_type === "HARD_CONSTRAINT_CONFLICT"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {validationResult.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                )}
                <span>{validationResult.message}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                <div>
                  Sleep Allowed:{" "}
                  <span className="font-semibold text-white">
                    {validationResult.min_allowable_sleep_hours ?? 6}h - {validationResult.max_allowable_sleep_hours ?? 10}h
                  </span>
                </div>
                <div>
                  Study Allowed:{" "}
                  <span className="font-semibold text-white">
                    {validationResult.min_allowable_study_hours ?? 1}h - {validationResult.max_allowable_study_hours ?? 8}h
                  </span>
                </div>
                <div>
                  Hard Occupied:{" "}
                  <span className="font-semibold text-white">
                    {((validationResult.hard_occupied_minutes || 0) / 60).toFixed(1)}h
                  </span>
                </div>
                <div>
                  Break Reserve:{" "}
                  <span className="font-semibold text-white">
                    {((validationResult.break_reserve_minutes || 120) / 60).toFixed(1)}h
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* College Timings */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              <span>College Hours</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">College Start Time</label>
                <input
                  type="time"
                  value={stringForm.college_start}
                  onChange={(e) => setStringForm((prev) => ({ ...prev, college_start: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">College End Time</label>
                <input
                  type="time"
                  value={stringForm.college_end}
                  onChange={(e) => setStringForm((prev) => ({ ...prev, college_end: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Fixed Meal Timings */}
          <div className="border-t border-white/8 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Utensils className="h-3.5 w-3.5 text-emerald-400" />
              <span>Fixed Meal Constraints</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-xl border border-white/6 bg-white/2 space-y-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-amber-400" /> Breakfast
                </span>
                <input
                  type="time"
                  value={stringForm.breakfast_start}
                  onChange={(e) => setStringForm((p) => ({ ...p, breakfast_start: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-1.5 px-2.5 text-xs text-white"
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Duration:</span>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={stringForm.breakfast_duration}
                    onChange={(e) => setStringForm((p) => ({ ...p, breakfast_duration: e.target.value }))}
                    className="w-16 rounded border border-white/10 bg-white/4 py-1 px-1.5 text-xs text-white text-center"
                  />
                  <span>mins</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-white/6 bg-white/2 space-y-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-400" /> Lunch
                </span>
                <input
                  type="time"
                  value={stringForm.lunch_start}
                  onChange={(e) => setStringForm((p) => ({ ...p, lunch_start: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-1.5 px-2.5 text-xs text-white"
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Duration:</span>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={stringForm.lunch_duration}
                    onChange={(e) => setStringForm((p) => ({ ...p, lunch_duration: e.target.value }))}
                    className="w-16 rounded border border-white/10 bg-white/4 py-1 px-1.5 text-xs text-white text-center"
                  />
                  <span>mins</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-white/6 bg-white/2 space-y-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 text-indigo-400" /> Dinner
                </span>
                <input
                  type="time"
                  value={stringForm.dinner_start}
                  onChange={(e) => setStringForm((p) => ({ ...p, dinner_start: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-1.5 px-2.5 text-xs text-white"
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Duration:</span>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={stringForm.dinner_duration}
                    onChange={(e) => setStringForm((p) => ({ ...p, dinner_duration: e.target.value }))}
                    className="w-16 rounded border border-white/10 bg-white/4 py-1 px-1.5 text-xs text-white text-center"
                  />
                  <span>mins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Break Reserve & Study / Sleep */}
          <div className="border-t border-white/8 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Flexible Targets & Break Reserve</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Break / Personal Reserve</label>
                <div className="relative">
                  <input
                    type="number"
                    step="15"
                    min="0"
                    max="480"
                    value={stringForm.break_reserve_minutes}
                    onChange={(e) => setStringForm((p) => ({ ...p, break_reserve_minutes: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">mins</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Daily Sleep Hours{" "}
                  {validationResult && (
                    <span className="text-[10px] text-indigo-300 font-semibold">
                      ({validationResult.min_allowable_sleep_hours ?? 6}h - {validationResult.max_allowable_sleep_hours ?? 10}h)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="4"
                    max="14"
                    value={stringForm.sleep_hours}
                    onChange={(e) => setStringForm((p) => ({ ...p, sleep_hours: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">hours</span>
                </div>
                {fieldErrors.sleep_hours && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.sleep_hours}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Daily Study Hours{" "}
                  {validationResult && (
                    <span className="text-[10px] text-indigo-300 font-semibold">
                      ({validationResult.min_allowable_study_hours ?? 1}h - {validationResult.max_allowable_study_hours ?? 8}h)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="16"
                    value={stringForm.study_hours}
                    onChange={(e) => setStringForm((p) => ({ ...p, study_hours: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">hours</span>
                </div>
                {fieldErrors.study_hours && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.study_hours}</p>
                )}
              </div>
            </div>
          </div>

          {fieldErrors.routine && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {fieldErrors.routine}
            </div>
          )}
        </Card>

        {/* Baseline Academic Indicators */}
        <Card>
          <div className="flex items-center gap-2.5 border-b border-white/8 pb-3">
            <Activity className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Baseline Academic Indicators</h2>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Attendance Percentage (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 85.5"
                value={stringForm.attendance}
                onChange={(e) => setStringForm((p) => ({ ...p, attendance: e.target.value }))}
                className={`w-full rounded-xl border bg-white/4 py-2 px-3 text-sm text-white focus:outline-hidden ${
                  fieldErrors.attendance ? "border-rose-500" : "border-white/10 focus:border-indigo-500"
                }`}
              />
              {fieldErrors.attendance && <p className="mt-1 text-xs text-rose-400">{fieldErrors.attendance}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Assignments Completed (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="e.g. 90"
                value={stringForm.assignments_completed}
                onChange={(e) => setStringForm((p) => ({ ...p, assignments_completed: e.target.value }))}
                className={`w-full rounded-xl border bg-white/4 py-2 px-3 text-sm text-white focus:outline-hidden ${
                  fieldErrors.assignments_completed ? "border-rose-500" : "border-white/10 focus:border-indigo-500"
                }`}
              />
              {fieldErrors.assignments_completed && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.assignments_completed}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Previous Grade (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 78.0"
                value={stringForm.previous_grade}
                onChange={(e) => setStringForm((p) => ({ ...p, previous_grade: e.target.value }))}
                className={`w-full rounded-xl border bg-white/4 py-2 px-3 text-sm text-white focus:outline-hidden ${
                  fieldErrors.previous_grade ? "border-rose-500" : "border-white/10 focus:border-indigo-500"
                }`}
              />
              {fieldErrors.previous_grade && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.previous_grade}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Class Participation (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 75.0"
                value={stringForm.participation}
                onChange={(e) => setStringForm((p) => ({ ...p, participation: e.target.value }))}
                className={`w-full rounded-xl border bg-white/4 py-2 px-3 text-sm text-white focus:outline-hidden ${
                  fieldErrors.participation ? "border-rose-500" : "border-white/10 focus:border-indigo-500"
                }`}
              />
              {fieldErrors.participation && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.participation}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Demographics and Context */}
        <Card>
          <div className="flex items-center gap-2.5 border-b border-white/8 pb-3">
            <User className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Demographics & Academic Background</h2>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Age</label>
              <input
                type="number"
                min="15"
                max="80"
                placeholder="e.g. 20"
                value={stringForm.age}
                onChange={(e) => setStringForm((p) => ({ ...p, age: e.target.value }))}
                className={`w-full rounded-xl border bg-white/4 py-2 px-3 text-sm text-white focus:outline-hidden ${
                  fieldErrors.age ? "border-rose-500" : "border-white/10 focus:border-indigo-500"
                }`}
              />
              {fieldErrors.age && <p className="mt-1 text-xs text-rose-400">{fieldErrors.age}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Gender</label>
              <select
                value={stringForm.gender}
                onChange={(e) => setStringForm((p) => ({ ...p, gender: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0c1017] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Parent Education
              </label>
              <select
                value={stringForm.parent_education}
                onChange={(e) => setStringForm((p) => ({ ...p, parent_education: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0c1017] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Parent Education</option>
                <option value="High School">High School</option>
                <option value="Some College">Some College</option>
                <option value="Bachelor's">Bachelor's</option>
                <option value="Master's">Master's</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Internet Access
              </label>
              <select
                value={stringForm.internet_access}
                onChange={(e) => setStringForm((p) => ({ ...p, internet_access: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0c1017] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Family Income
              </label>
              <select
                value={stringForm.family_income}
                onChange={(e) => setStringForm((p) => ({ ...p, family_income: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0c1017] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Income Bracket</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Extra Classes
              </label>
              <select
                value={stringForm.extra_classes}
                onChange={(e) => setStringForm((p) => ({ ...p, extra_classes: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0c1017] py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">Select Option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={isSaving || (validationResult !== null && !validationResult.valid)}
            className="flex items-center gap-2 px-6"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving & Running ML..." : "Save Profile & Trigger Simulation"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
