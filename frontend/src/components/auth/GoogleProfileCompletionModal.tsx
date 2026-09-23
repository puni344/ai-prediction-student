import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/api";
import { extractErrorMessage } from "../../utils/errors";
import { DepartmentSelector } from "../common/DepartmentSelector";
import { ProgramSelector } from "../common/ProgramSelector";
import { AcademicYearSelector } from "../common/AcademicYearSelector";
import { getYearOptionsForProgram } from "../../constants/programs";
import { Button } from "../common/Button";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface GoogleProfileCompletionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  userEmail?: string;
}

export const GoogleProfileCompletionModal: React.FC<GoogleProfileCompletionModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const navigate = useNavigate();
  const [rollNumber, setRollNumber] = useState("");
  const [program, setProgram] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [yearNotice, setYearNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProgramChange = (newProg: string) => {
    setProgram(newProg);
    setYearNotice(null);
    if (academicYear) {
      const validYears = getYearOptionsForProgram(newProg);
      if (!validYears.includes(academicYear)) {
        setAcademicYear("");
        setYearNotice("Your current year must be selected again because the selected program has a different duration.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanRoll = rollNumber.trim().toUpperCase();
    if (!cleanRoll) {
      setError("Roll Number is required to complete your student profile.");
      return;
    }
    if (!program) {
      setError("Academic Program is required.");
      return;
    }
    if (!department) {
      setError("Academic Department is required.");
      return;
    }
    if (!academicYear) {
      setError("Current Year is required.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.completeGoogleProfile({
        roll_number: cleanRoll,
        program,
        department,
        academic_year: academicYear,
      });
      navigate("/student/dashboard");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to update profile. That roll number may already be registered."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/12 bg-[#0e121b] p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Complete Student Profile</h3>
          <p className="mt-1 text-xs text-slate-400">
            Google authentication verified {userEmail ? `(${userEmail})` : ""}. Please provide your academic profile details.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Roll / Student ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 23BFA12001"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 px-3.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 uppercase"
            />
            <p className="mt-1 text-[11px] text-slate-500">Must be unique to your student record.</p>
          </div>

          {/* Academic Program */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Academic Program <span className="text-rose-400">*</span>
            </label>
            <ProgramSelector
              value={program}
              onChange={handleProgramChange}
              disabled={isLoading}
            />
          </div>

          {/* Academic Department */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Academic Department <span className="text-rose-400">*</span>
            </label>
            <DepartmentSelector
              value={department}
              onChange={(val) => setDepartment(val)}
              hideLabel={true}
              disabled={isLoading}
            />
          </div>

          {/* Current Year */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Current Year <span className="text-rose-400">*</span>
            </label>
            <AcademicYearSelector
              programId={program}
              value={academicYear}
              onChange={(val) => {
                setAcademicYear(val);
                setYearNotice(null);
              }}
              notice={yearNotice}
              hideLabel={true}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
            Finalize & Enter Dashboard
          </Button>
        </form>
      </div>
    </div>
  );
};
