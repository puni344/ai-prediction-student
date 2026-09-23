import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleProtectedRoute } from "./routes/RoleProtectedRoute";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

// Public Pages
import { LandingPage } from "./pages/public/LandingPage";
import { AboutPage } from "./pages/public/AboutPage";
import { StudentAuthPage } from "./pages/auth/StudentAuthPage";
import { FacultyAuthPage } from "./pages/auth/FacultyAuthPage";
import { AdminLoginPage } from "./pages/auth/AdminLoginPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";

// Layout
import { DashboardLayout } from "./components/layout/DashboardLayout";

// Student Pages
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentProfilePage } from "./pages/student/StudentProfilePage";
import { PredictionPage } from "./pages/student/PredictionPage";
import { ResultsPage } from "./pages/student/ResultsPage";
import { RiskAnalysisPage } from "./pages/student/RiskAnalysisPage";
import { ExplainabilityPage } from "./pages/student/ExplainabilityPage";
import { ProgressPage } from "./pages/student/ProgressPage";
import { PerformanceAnalysisPage } from "./pages/student/PerformanceAnalysisPage";
import { SettingsPage } from "./pages/student/SettingsPage";
import { AIAdvisorPage } from "./pages/student/AIAdvisorPage";
import { TimetablePage } from "./pages/student/TimetablePage";
import { CompleteProfilePage } from "./pages/student/CompleteProfilePage";

// Faculty Pages
import { FacultyDashboard } from "./pages/faculty/FacultyDashboard";
import { FacultyStudentsPage } from "./pages/faculty/FacultyStudentsPage";
import { FacultyStudentDetailPage } from "./pages/faculty/FacultyStudentDetailPage";
import { FacultyAnalyticsPage } from "./pages/faculty/FacultyAnalyticsPage";
import { FacultyPerformanceAnalysisPage } from "./pages/faculty/FacultyPerformanceAnalysisPage";
import { FacultyRiskPage } from "./pages/faculty/FacultyRiskPage";
import { FacultySettingsPage } from "./pages/faculty/FacultySettingsPage";

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminStudentsPage } from "./pages/admin/AdminStudentsPage";
import { AdminFacultyPage } from "./pages/admin/AdminFacultyPage";
import { AdminCalendarPage } from "./pages/admin/AdminCalendarPage";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Student Authentication Entry Points (Isolated) */}
          <Route path="/student/login" element={<StudentAuthPage initialView="login" />} />
          <Route path="/student/register" element={<StudentAuthPage initialView="register" />} />
          <Route path="/student/signup" element={<Navigate to="/student/register" replace />} />
          <Route path="/student/forgot-password" element={<ForgotPasswordPage portalRole="student" />} />
          <Route path="/student/verify-email" element={<VerifyEmailPage portalRole="student" />} />

          {/* Faculty Authentication Entry Points (Isolated) */}
          <Route path="/faculty/login" element={<FacultyAuthPage initialView="login" />} />
          <Route path="/faculty/register" element={<FacultyAuthPage initialView="register" />} />
          <Route path="/faculty/signup" element={<Navigate to="/faculty/register" replace />} />
          <Route path="/faculty/forgot-password" element={<ForgotPasswordPage portalRole="faculty" />} />
          <Route path="/faculty/verify-email" element={<VerifyEmailPage portalRole="faculty" />} />

          {/* Institution Administrator Entry Point (Isolated) */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/final/admin/login" element={<AdminLoginPage />} />
          <Route path="/final/student/login" element={<StudentAuthPage initialView="login" />} />
          <Route path="/final/faculty/login" element={<FacultyAuthPage initialView="login" />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/faculty" element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />

          {/* Legacy / Shared Route Fallbacks */}
          <Route path="/login" element={<Navigate to="/student/login" replace />} />
          <Route path="/signup" element={<Navigate to="/student/register" replace />} />
          <Route path="/register" element={<Navigate to="/student/register" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected Area */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              {/* Student Portal (ROLE_STUDENT only) */}
              <Route element={<RoleProtectedRoute allowedRoles={["student"]} />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/profile" element={<StudentProfilePage />} />
                <Route path="/student/prediction" element={<PredictionPage />} />
                <Route path="/student/results" element={<ResultsPage />} />
                <Route path="/student/risk-analysis" element={<RiskAnalysisPage />} />
                <Route path="/student/explainability" element={<ExplainabilityPage />} />
                <Route path="/student/performance-analysis" element={<PerformanceAnalysisPage />} />
                <Route path="/student/progress" element={<Navigate to="/student/performance-analysis" replace />} />
                <Route path="/student/ai-advisor" element={<AIAdvisorPage />} />
                <Route path="/student/timetable" element={<TimetablePage />} />
                <Route path="/student/settings" element={<SettingsPage />} />
                <Route path="/student/complete-profile" element={<CompleteProfilePage />} />
              </Route>

              {/* Faculty Portal (ROLE_FACULTY only) */}
              <Route element={<RoleProtectedRoute allowedRoles={["faculty"]} />}>
                <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
                <Route path="/faculty/students" element={<FacultyStudentsPage />} />
                <Route path="/faculty/students/:studentId" element={<FacultyStudentDetailPage />} />
                <Route path="/faculty/performance-analysis" element={<FacultyPerformanceAnalysisPage />} />
                <Route path="/faculty/analytics" element={<FacultyAnalyticsPage />} />
                <Route path="/faculty/risk-monitor" element={<FacultyRiskPage />} />
                <Route path="/faculty/risk-analysis" element={<FacultyRiskPage />} />
                <Route path="/faculty/settings" element={<FacultySettingsPage />} />
              </Route>

              {/* Administrator Portal (ROLE_ADMIN only) */}
              <Route element={<RoleProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/students" element={<AdminStudentsPage />} />
                <Route path="/admin/faculty" element={<AdminFacultyPage />} />
                <Route path="/admin/calendar" element={<AdminCalendarPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
