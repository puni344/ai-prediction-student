import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Cpu, Eye, EyeOff, Lock, Mail, User, Hash, Briefcase, GraduationCap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { PasswordStrengthMeter, isPasswordValid } from "../../components/auth/PasswordStrengthMeter";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import { DepartmentSelector } from "../../components/common/DepartmentSelector";
import { MultiDepartmentSelector } from "../../components/common/MultiDepartmentSelector";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<"student" | "faculty">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Student-specific fields
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("Computer Science and Engineering");

  // Faculty-specific fields
  const [facultyId, setFacultyId] = useState("");
  const [facultyDepartments, setFacultyDepartments] = useState<string[]>([
    "Computer Science and Engineering",
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline validation checks
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isRollNumberValid =
    role !== "student" ||
    (rollNumber.trim().length >= 2 && /^[A-Za-z0-9\-_]+$/.test(rollNumber.trim()));
  const isFacultyIdValid =
    role !== "faculty" ||
    (facultyId.trim().length >= 2 && /^[A-Za-z0-9\-_]+$/.test(facultyId.trim()));
  const isStudentDeptValid = role !== "student" || department.trim().length > 0;
  const isFacultyDeptValid = role !== "faculty" || facultyDepartments.length > 0;
  const isPasswordCriteriaMet = isPasswordValid(password);
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === "student" && !rollNumber.trim()) {
      setError("Roll number is compulsory for student registration.");
      return;
    }

    if (role === "student" && !isRollNumberValid) {
      setError("Roll number must be alphanumeric (hyphens/underscores allowed, minimum 2 characters).");
      return;
    }

    if (role === "faculty" && !facultyId.trim()) {
      setError("Faculty ID / Employee ID is required for faculty registration.");
      return;
    }

    if (role === "faculty" && !isFacultyIdValid) {
      setError("Faculty ID must be alphanumeric (hyphens/underscores allowed, minimum 2 characters).");
      return;
    }

    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    if (role === "student" && !isStudentDeptValid) {
      setError("Academic department is required. Please select a department.");
      return;
    }

    if (role === "faculty" && !isFacultyDeptValid) {
      setError("Please select at least one academic department for faculty registration.");
      return;
    }

    if (!isPasswordCriteriaMet) {
      setError("Password does not satisfy institutional security requirements. Please check all criteria.");
      return;
    }

    if (!doPasswordsMatch) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setIsLoading(true);

    try {
      const normalizedRollNumber = role === "student" ? rollNumber.trim().toUpperCase() : undefined;
      const normalizedFacultyId = role === "faculty" ? facultyId.trim().toUpperCase() : undefined;

      await authService.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        roll_number: normalizedRollNumber,
        faculty_id: normalizedFacultyId,
        department: role === "student" ? department : undefined,
        departments: role === "faculty" ? facultyDepartments : undefined,
      });

      // Navigate to OTP verification page
      navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(", "));
      } else {
        setError("Something went wrong while creating your account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#07090e] bg-grid-pattern px-4 py-12 sm:px-6 lg:px-8 text-slate-100 overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 shadow-lg shadow-indigo-500/15">
            <Cpu className="h-5 w-5 text-indigo-400" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">StudentPredict</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Create an Account
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Enter institutional credentials to join the AI Academic Intelligence Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="border border-white/10 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {/* Role selector tabs */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1 border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                role === "student"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Student Lab
            </button>
            <button
              type="button"
              onClick={() => setRole("faculty")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                role === "faculty"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Faculty Lab
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={role === "student" ? "Jane Doe" : "Dr. Jane Smith"}
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Student: Roll Number */}
            {role === "student" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Roll Number <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-indigo-300 font-mono">Unique & Compulsory</span>
                </div>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 2024-CSE-0042"
                    className={`w-full rounded-xl border bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white font-mono placeholder-slate-500 focus:outline-hidden ${
                      rollNumber && !isRollNumberValid
                        ? "border-rose-500"
                        : "border-white/10 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Faculty: Employee ID */}
            {role === "faculty" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Faculty / Employee ID <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-indigo-300 font-mono">Unique ID</span>
                </div>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value)}
                    placeholder="e.g. FAC-2024-001"
                    className={`w-full rounded-xl border bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white font-mono placeholder-slate-500 focus:outline-hidden ${
                      facultyId && !isFacultyIdValid
                        ? "border-rose-500"
                        : "border-white/10 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Department: Single for Student, Multi for Faculty */}
            {role === "student" ? (
              <DepartmentSelector
                value={department}
                onChange={setDepartment}
                required
              />
            ) : (
              <MultiDepartmentSelector
                values={facultyDepartments}
                onChange={setFacultyDepartments}
                required
              />
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars with mixed cases"
                  className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full rounded-xl border bg-white/4 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-hidden ${
                    confirmPassword && !doPasswordsMatch
                      ? "border-rose-500"
                      : "border-white/10 focus:border-indigo-500"
                  }`}
                />
              </div>
              {confirmPassword && !doPasswordsMatch && (
                <p className="mt-1 text-xs text-rose-400">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full font-bold shadow-indigo-500/25 mt-2"
            >
              {isLoading ? "Verifying Credentials..." : "Register & Verify Email"}
            </Button>
          </form>

          {/* Google Sign-in for student/faculty */}
          <div className="mt-6 border-t border-white/8 pt-6">
            <GoogleSignInButton buttonText="Register with Google" />
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Already registered?{" "}
              <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
