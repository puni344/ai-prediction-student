import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Clock,
  Moon,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Utensils,
  Sun,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { studentService, timetableService } from "../../services/api";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { ProgramSelector } from "../../components/common/ProgramSelector";
import { DepartmentSelector } from "../../components/common/DepartmentSelector";
import { AcademicYearSelector } from "../../components/common/AcademicYearSelector";
import { extractErrorMessage } from "../../utils/errors";
import { TimetableValidationResult } from "../../types";

export const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  // Step 1: Academic Identity
  const [program, setProgram] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  // Step 2: Complete Daily Routine & College Timings
  const [collegeStart, setCollegeStart] = useState("09:00");
  const [collegeEnd, setCollegeEnd] = useState("16:00");
  const [breakfastStart, setBreakfastStart] = useState("08:00");
  const [breakfastDuration, setBreakfastDuration] = useState("30");
  const [lunchStart, setLunchStart] = useState("13:00");
  const [lunchDuration, setLunchDuration] = useState("30");
  const [dinnerStart, setDinnerStart] = useState("20:00");
  const [dinnerDuration, setDinnerDuration] = useState("30");
  const [breakReserveHours, setBreakReserveHours] = useState("2");
  const [studyHours, setStudyHours] = useState("4");
  const [sleepHours, setSleepHours] = useState("8");

  const [step, setStep] = useState<1 | 2>(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live validation result from authoritative backend constraint engine
  const [validationResult, setValidationResult] = useState<TimetableValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleProgramChange = (val: string) => {
    setProgram(val);
    setAcademicYear("");
    setFieldErrors((p) => {
      const n = { ...p };
      delete n.program;
      delete n.academicYear;
      return n;
    });
  };

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    setFieldErrors((p) => {
      const n = { ...p };
      delete n.department;
      return n;
    });
  };

  const handleYearChange = (val: string) => {
    setAcademicYear(val);
    setFieldErrors((p) => {
      const n = { ...p };
      delete n.academicYear;
      return n;
    });
  };

  // Run authoritative backend 24h capacity validation whenever routine changes
  useEffect(() => {
    if (step !== 2) return;

    let isMounted = true;
    const runValidation = async () => {
      setIsValidating(true);
      try {
        const breakMins = Math.round((parseFloat(breakReserveHours) || 2) * 60);
        const res = await timetableService.validate({
          college_start: collegeStart,
          college_end: collegeEnd,
          breakfast_start: breakfastStart,
          breakfast_duration: parseInt(breakfastDuration) || 30,
          lunch_start: lunchStart,
          lunch_duration: parseInt(lunchDuration) || 30,
          dinner_start: dinnerStart,
          dinner_duration: parseInt(dinnerDuration) || 30,
          break_reserve_minutes: breakMins,
          daily_study_hours: parseFloat(studyHours) || 0,
          sleep_hours: parseFloat(sleepHours) || 0,
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
        console.warn("Real-time validation error:", err);
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    const timer = setTimeout(runValidation, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    step,
    collegeStart,
    collegeEnd,
    breakfastStart,
    breakfastDuration,
    lunchStart,
    lunchDuration,
    dinnerStart,
    dinnerDuration,
    breakReserveHours,
    studyHours,
    sleepHours,
  ]);

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!program.trim()) errs.program = "Please select your academic program.";
    if (!department.trim()) errs.department = "Please select your academic department.";
    if (!academicYear.trim()) errs.academicYear = "Please select your academic year.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};

    const std = parseFloat(studyHours);
    const slp = parseFloat(sleepHours);
    const brk = parseFloat(breakReserveHours);

    if (isNaN(std) || std < 0.5 || std > 16) {
      errs.studyHours = "Study hours must be between 0.5h and 16h.";
    }
    if (isNaN(slp) || slp < 4 || slp > 14) {
      errs.sleepHours = "Sleep hours must be between 4h and 14h.";
    }
    if (isNaN(brk) || brk < 0 || brk > 8) {
      errs.breakReserve = "Break reserve must be between 0h and 8h.";
    }

    if (validationResult && !validationResult.valid) {
      errs.routine = validationResult.message;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateStep2()) return;

    const studyVal = parseFloat(studyHours) || 0;
    const sleepVal = parseFloat(sleepHours) || 0;
    const breakMins = Math.round((parseFloat(breakReserveHours) || 2) * 60);

    setIsSubmitting(true);
    try {
      // Update Student Profile with complete identity and daily routine
      await studentService.updateProfile({
        program,
        department,
        academic_year: academicYear,
        study_hours: studyVal,
        sleep_hours: sleepVal,
        college_start: collegeStart,
        college_end: collegeEnd,
        breakfast_start: breakfastStart,
        breakfast_duration: parseInt(breakfastDuration) || 30,
        lunch_start: lunchStart,
        lunch_duration: parseInt(lunchDuration) || 30,
        dinner_start: dinnerStart,
        dinner_duration: parseInt(dinnerDuration) || 30,
        break_reserve_minutes: breakMins,
      });

      await refreshUser?.();
      navigate("/student/dashboard", { replace: true });
    } catch (err: any) {
      setSubmitError(
        extractErrorMessage(err, "Failed to save complete profile. Please check constraints.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <GraduationCap className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Complete Academic & Routine Onboarding
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Configure your academic identity and complete daily routine to initialize your predictive model and timetable.
          </p>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === 1
                  ? "bg-indigo-600 text-white"
                  : "bg-white/5 text-slate-400 border border-white/10"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              Academic Identity
            </div>
            <div className="h-px w-6 bg-white/10" />
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === 2
                  ? "bg-indigo-600 text-white"
                  : "bg-white/5 text-slate-400 border border-white/10"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              Daily Routine & Timings
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{submitError}</span>
          </div>
        )}

        {/* STEP 1: Academic Identity */}
        {step === 1 && (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-white/8 pb-4">
              <h2 className="text-base font-bold text-white">Course & Academic Identity</h2>
              <p className="text-xs text-slate-400 mt-1">
                Select your enrolled program, official department, and current year of study.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Academic Program <span className="text-rose-400">*</span>
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
                  onChange={handleDepartmentChange}
                  error={fieldErrors.department}
                  hideLabel={false}
                />
              </div>

              <div>
                <AcademicYearSelector
                  value={academicYear}
                  programId={program}
                  onChange={handleYearChange}
                  error={fieldErrors.academicYear}
                  disabled={!program}
                  hideLabel={false}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="flex items-center gap-2"
              >
                <span>Continue to Routine</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: Daily Routine & College Timings */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-6 sm:p-8 space-y-6">
              <div className="border-b border-white/8 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Daily Routine & Fixed Timings</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Set your meals, college hours, break reserve, and study targets.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                    Shared 24h Capacity
                  </span>
                </div>
              </div>

              {/* Dynamic Capacity Notification */}
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
                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  <span>College Hours</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">College Start</label>
                    <input
                      type="time"
                      value={collegeStart}
                      onChange={(e) => setCollegeStart(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">College End</label>
                    <input
                      type="time"
                      value={collegeEnd}
                      onChange={(e) => setCollegeEnd(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Meal Timings */}
              <div className="border-t border-white/8 pt-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Utensils className="h-4 w-4 text-emerald-400" />
                  <span>Fixed Meal Constraints</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 rounded-xl border border-white/6 bg-white/2 space-y-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Coffee className="h-3.5 w-3.5 text-amber-400" /> Breakfast
                    </span>
                    <input
                      type="time"
                      value={breakfastStart}
                      onChange={(e) => setBreakfastStart(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/4 py-1.5 px-2.5 text-xs text-white"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>Duration:</span>
                      <input
                        type="number"
                        min="10"
                        max="120"
                        value={breakfastDuration}
                        onChange={(e) => setBreakfastDuration(e.target.value)}
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
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/4 py-1.5 px-2.5 text-xs text-white"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>Duration:</span>
                      <input
                        type="number"
                        min="10"
                        max="120"
                        value={lunchDuration}
                        onChange={(e) => setLunchDuration(e.target.value)}
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
                      value={dinnerStart}
                      onChange={(e) => setDinnerStart(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/4 py-1.5 px-2.5 text-xs text-white"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>Duration:</span>
                      <input
                        type="number"
                        min="10"
                        max="120"
                        value={dinnerDuration}
                        onChange={(e) => setDinnerDuration(e.target.value)}
                        className="w-16 rounded border border-white/10 bg-white/4 py-1 px-1.5 text-xs text-white text-center"
                      />
                      <span>mins</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Break Reserve & Study / Sleep */}
              <div className="border-t border-white/8 pt-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span>Flexible Targets & Break Reserve</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Break / Personal Reserve</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="8"
                        value={breakReserveHours}
                        onChange={(e) => setBreakReserveHours(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500">hours</span>
                    </div>
                    {fieldErrors.breakReserve && (
                      <p className="mt-1 text-xs text-rose-400">{fieldErrors.breakReserve}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Daily Sleep Target{" "}
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
                        value={sleepHours}
                        onChange={(e) => setSleepHours(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500">hours</span>
                    </div>
                    {fieldErrors.sleepHours && (
                      <p className="mt-1 text-xs text-rose-400">{fieldErrors.sleepHours}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Daily Study Target{" "}
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
                        value={studyHours}
                        onChange={(e) => setStudyHours(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/4 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-hidden"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500">hours</span>
                    </div>
                    {fieldErrors.studyHours && (
                      <p className="mt-1 text-xs text-rose-400">{fieldErrors.studyHours}</p>
                    )}
                  </div>
                </div>
              </div>

              {fieldErrors.routine && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  {fieldErrors.routine}
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 flex items-center justify-between border-t border-white/8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Identity</span>
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || (validationResult !== null && !validationResult.valid)}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? "Saving & Initializing..." : "Complete & Run Model"}</span>
                </Button>
              </div>
            </Card>
          </form>
        )}
      </div>
    </div>
  );
};
