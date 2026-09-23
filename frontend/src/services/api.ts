import axios from "axios";
import {
  TokenResponse,
  User,
  StudentProfile,
  PredictionSimulationRequest,
  PredictionResponse,
  DailySnapshotResponse,
  SnapshotTrendResponse,
  FacultyDashboardResponse,
  FacultyStudentListResponse,
  FacultyStudentDetailResponse,
  FacultyAnalyticsResponse,
  FacultyRiskResponse,
  ForgotPasswordResponse,
  AdminOverviewResponse,
  AdminStudentListResponse,
  AdminFacultyListResponse,
  DepartmentSummary,
  DayResolutionResponse,
  CalendarMonthResponse,
  CalendarYearResponse,
  StudentOverrideResponse,
  AdminCalendarEntry,
  AdminOverrideResponse,
  TimetableSimulationRequest,
  TimetableSimulationResponse,
  TimetableSaveRequest,
  TimetableSaveResponse,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      const path = window.location.pathname;
      if (!path.includes("/login") && !path.includes("/signup") && !path.includes("/register")) {
        if (path.startsWith("/admin")) {
          window.location.href = "/admin/login";
        } else if (path.startsWith("/faculty")) {
          window.location.href = "/faculty/login";
        } else {
          window.location.href = "/student/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authService = {
  async login(payload: {
    email: string;
    password: string;
    captcha_token?: string;
    expected_role?: "student" | "faculty" | "admin";
  }): Promise<TokenResponse> {
    const url = payload.expected_role
      ? `/auth/${payload.expected_role}/login`
      : "/auth/login";
    const res = await api.post<TokenResponse>(url, payload);
    return res.data;
  },
  async studentLogin(payload: { email: string; password: string; captcha_token?: string }): Promise<TokenResponse> {
    return this.login({ ...payload, expected_role: "student" });
  },
  async facultyLogin(payload: { email: string; password: string; captcha_token?: string }): Promise<TokenResponse> {
    return this.login({ ...payload, expected_role: "faculty" });
  },
  async adminLogin(payload: { email: string; password: string; captcha_token?: string }): Promise<TokenResponse> {
    return this.login({ ...payload, expected_role: "admin" });
  },
  async signup(payload: {
    email: string;
    password: string;
    full_name: string;
    role: "student" | "faculty";
    roll_number?: string;
    faculty_id?: string;
    program?: string;
    department?: string;
    departments?: string[];
    academic_year?: string;
    captcha_token?: string;
  }): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>("/auth/signup", payload);
    return res.data;
  },
  async getMe(): Promise<User> {
    const res = await api.get<User>("/auth/me");
    return res.data;
  },
  async verifyEmail(payload: { email: string; otp: string }): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>("/auth/verify-email", payload);
    return res.data;
  },
  async resendVerification(payload: { email: string; captcha_token?: string }): Promise<{ status: string; message: string }> {
    const res = await api.post<{ status: string; message: string }>("/auth/resend-verification", payload);
    return res.data;
  },
  async forgotPassword(payload: { email: string; captcha_token?: string }): Promise<ForgotPasswordResponse> {
    const res = await api.post<ForgotPasswordResponse>("/auth/forgot-password", payload);
    return res.data;
  },
  async verifyResetOtp(payload: { email: string; otp: string }): Promise<{ status: string; reset_token: string; message: string }> {
    const res = await api.post<{ status: string; reset_token: string; message: string }>("/auth/verify-reset-otp", payload);
    return res.data;
  },
  async resetPassword(payload: { email: string; reset_token: string; new_password: string; confirm_password: string }): Promise<{ status: string; message: string }> {
    const res = await api.post<{ status: string; message: string }>("/auth/reset-password", payload);
    return res.data;
  },
  async googleAuth(payload: { id_token: string }): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>("/auth/google", payload);
    return res.data;
  },
  async completeGoogleProfile(payload: {
    roll_number: string;
    program: string;
    department: string;
    academic_year: string;
  }): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>("/auth/google/complete-profile", payload);
    return res.data;
  },
  async getEmailDiagnostic(): Promise<any> {
    const res = await api.get("/auth/email-diagnostic");
    return res.data;
  },
};

// Student Profile Services
export const studentService = {
  async getProfile(): Promise<StudentProfile> {
    const res = await api.get<StudentProfile>("/students/profile");
    return res.data;
  },
  async updateProfile(payload: Partial<StudentProfile>): Promise<StudentProfile> {
    const res = await api.put<StudentProfile>("/students/profile", payload);
    return res.data;
  },
};

// Prediction Services
export const predictionService = {
  async getTodaySnapshot(forceAllowBefore9 = false): Promise<DailySnapshotResponse | null> {
    const res = await api.get<DailySnapshotResponse | null>(
      `/predictions/snapshot/today${forceAllowBefore9 ? "?force_allow_before_9=true" : ""}`
    );
    return res.data;
  },
  async getSnapshots(limit = 60): Promise<DailySnapshotResponse[]> {
    const res = await api.get<DailySnapshotResponse[]>("/predictions/snapshots", { params: { limit } });
    return res.data;
  },
  async getTrends(viewType: "day" | "week" | "month" | "year" | "weekly" | "monthly" | "semester" = "day"): Promise<SnapshotTrendResponse> {
    const res = await api.get<SnapshotTrendResponse>("/predictions/trends", { params: { view_type: viewType } });
    return res.data;
  },
  async simulate(payload: PredictionSimulationRequest): Promise<PredictionResponse> {
    const res = await api.post<PredictionResponse>("/predictions/simulate", payload);
    return res.data;
  },
  async getHistory(): Promise<PredictionResponse[]> {
    const res = await api.get<PredictionResponse[]>("/predictions/history");
    return res.data;
  },
  async getLatest(): Promise<PredictionResponse | null> {
    const res = await api.get<PredictionResponse | null>("/predictions/latest");
    return res.data;
  },
};

// Faculty Cohort Services
export const facultyService = {
  async getDashboard(): Promise<FacultyDashboardResponse> {
    const res = await api.get<FacultyDashboardResponse>("/faculty/dashboard");
    return res.data;
  },
  async getStudents(params?: {
    search?: string;
    roll_number?: string;
    department?: string;
    risk_level?: string;
    skip?: number;
    limit?: number;
  }): Promise<FacultyStudentListResponse> {
    const res = await api.get<FacultyStudentListResponse>("/faculty/students", { params });
    return res.data;
  },
  async getStudentDetail(id: number): Promise<FacultyStudentDetailResponse> {
    const res = await api.get<FacultyStudentDetailResponse>(`/faculty/students/${id}`);
    return res.data;
  },
  async getStudentSnapshots(id: number, limit = 365): Promise<DailySnapshotResponse[]> {
    const res = await api.get<DailySnapshotResponse[]>(`/faculty/students/${id}/snapshots`, { params: { limit } });
    return res.data;
  },
  async getStudentTrends(id: number, viewType: "day" | "week" | "month" | "year" | "weekly" | "monthly" | "semester" = "day"): Promise<SnapshotTrendResponse> {
    const res = await api.get<SnapshotTrendResponse>(`/faculty/students/${id}/trends`, { params: { view_type: viewType } });
    return res.data;
  },
  async getAnalytics(): Promise<FacultyAnalyticsResponse> {
    const res = await api.get<FacultyAnalyticsResponse>("/faculty/analytics");
    return res.data;
  },
  async getRiskAnalysis(params?: { risk_level?: string }): Promise<FacultyRiskResponse> {
    const res = await api.get<FacultyRiskResponse>("/faculty/risk-analysis", { params });
    return res.data;
  },
  async getRiskMonitor(params?: { risk_level?: string }): Promise<FacultyRiskResponse> {
    const res = await api.get<FacultyRiskResponse>("/faculty/risk-monitor", { params });
    return res.data;
  },
};


import type {
  TimetablePreferences,
  TimetableBlock,
  TimetableResponse,
  TimetableValidationResult,
  DayStatusResponse,
  CalendarBusyEvent,
  StudyPlanConstraints,
  RecommendationResponse,
  ChatSession,
  ChatMessage,
} from "../types";

export const recommendationService = {
  async generate(constraints?: StudyPlanConstraints): Promise<RecommendationResponse> {
    const res = await api.post<RecommendationResponse>("/recommendations/generate", constraints || {});
    return res.data;
  },
};

export const chatService = {
  async getSessions(): Promise<ChatSession[]> {
    const res = await api.get<ChatSession[]>("/chat/sessions");
    return res.data;
  },
  async createSession(title?: string): Promise<ChatSession> {
    const res = await api.post<ChatSession>("/chat/sessions", { title });
    return res.data;
  },
  async getMessages(sessionId: number): Promise<ChatMessage[]> {
    const res = await api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
    return res.data;
  },
  async sendMessage(message: string, sessionId?: number): Promise<ChatMessage> {
    const res = await api.post<ChatMessage>("/chat/message", { message, session_id: sessionId });
    return res.data;
  },
  async clearHistory(): Promise<{ success: boolean; message: string }> {
    const res = await api.delete<{ success: boolean; message: string }>("/chat/history");
    return res.data;
  },
  async deleteSession(sessionId: number): Promise<{ success: boolean; message: string }> {
    const res = await api.delete<{ success: boolean; message: string }>(`/chat/sessions/${sessionId}`);
    return res.data;
  },
};


// Administrator Services
export const adminService = {
  async getOverview(department?: string): Promise<AdminOverviewResponse> {
    const res = await api.get<AdminOverviewResponse>("/admin/overview", {
      params: department && department !== "all" ? { department } : undefined,
    });
    return res.data;
  },
  async getStudents(params?: {
    search?: string;
    department?: string;
    risk_level?: string;
    skip?: number;
    limit?: number;
  }): Promise<AdminStudentListResponse> {
    const res = await api.get<AdminStudentListResponse>("/admin/students", { params });
    return res.data;
  },
  async getStudentDetail(id: number): Promise<FacultyStudentDetailResponse> {
    const res = await api.get<FacultyStudentDetailResponse>(`/admin/students/${id}`);
    return res.data;
  },
  async getFaculty(params?: {
    search?: string;
    department?: string;
    skip?: number;
    limit?: number;
  }): Promise<AdminFacultyListResponse> {
    const res = await api.get<AdminFacultyListResponse>("/admin/faculty", { params });
    return res.data;
  },
  async getDepartments(): Promise<DepartmentSummary[]> {
    const res = await api.get<DepartmentSummary[]>("/admin/departments");
    return res.data;
  },
};

// Student Timetable Planner Services
export const timetableService = {
  async getPreferences(date?: string): Promise<TimetablePreferences> {
    const res = await api.get<TimetablePreferences>("/students/timetable/preferences", { params: { date } });
    return res.data;
  },
  async getDayStatus(date?: string): Promise<DayStatusResponse> {
    const res = await api.get<DayStatusResponse>("/students/timetable/day-status", { params: { date } });
    return res.data;
  },
  async toggleHoliday(date: string, is_holiday: boolean, label?: string): Promise<any> {
    const res = await api.post("/students/timetable/holiday", { date, is_holiday, label });
    return res.data;
  },
  async getHolidays(): Promise<Array<{ date: string; label: string }>> {
    const res = await api.get("/students/timetable/holidays");
    return res.data;
  },
  async connectCalendar(payload: { access_token?: string; calendar_email?: string; mock_events?: any[] }): Promise<any> {
    const res = await api.post("/students/timetable/calendar/connect", payload);
    return res.data;
  },
  async disconnectCalendar(): Promise<any> {
    const res = await api.post("/students/timetable/calendar/disconnect");
    return res.data;
  },
  async savePreferences(payload: TimetablePreferences): Promise<TimetablePreferences> {
    const res = await api.post<TimetablePreferences>("/students/timetable/preferences", payload);
    return res.data;
  },
  async validate(payload: TimetablePreferences): Promise<TimetableValidationResult> {
    const res = await api.post<TimetableValidationResult>("/students/timetable/validate", payload);
    return res.data;
  },
  async generate(payload: TimetablePreferences): Promise<TimetableResponse> {
    const res = await api.post<TimetableResponse>("/students/timetable/generate", payload);
    return res.data;
  },
  async simulate(payload: TimetableSimulationRequest): Promise<TimetableSimulationResponse> {
    const res = await api.post<TimetableSimulationResponse>("/timetable/simulate", payload);
    return res.data;
  },
  async save(payload: TimetableSaveRequest): Promise<TimetableSaveResponse> {
    const res = await api.post<TimetableSaveResponse>("/timetable/save", payload);
    return res.data;
  },
};

// Academic Calendar Services
export const calendarService = {
  async getDayStatus(date?: string): Promise<DayResolutionResponse> {
    const res = await api.get<DayResolutionResponse>("/calendar/day", { params: { date } });
    return res.data;
  },
  async getMonth(year: number, month: number): Promise<CalendarMonthResponse> {
    const res = await api.get<CalendarMonthResponse>("/calendar/month", { params: { year, month } });
    return res.data;
  },
  async getYear(year: number): Promise<CalendarYearResponse> {
    const res = await api.get<CalendarYearResponse>("/calendar/year", { params: { year } });
    return res.data;
  },
  async setStudentOverride(date: string, college_status: boolean, reason?: string): Promise<StudentOverrideResponse> {
    const res = await api.put<StudentOverrideResponse>(`/calendar/student-overrides/${date}`, {
      college_status,
      reason,
    });
    return res.data;
  },
  async deleteStudentOverride(date: string): Promise<StudentOverrideResponse> {
    const res = await api.delete<StudentOverrideResponse>(`/calendar/student-overrides/${date}`);
    return res.data;
  },
};

// Admin Calendar Management Services
export const adminCalendarService = {
  async getCalendar(year?: number): Promise<AdminCalendarEntry[]> {
    const res = await api.get<any>("/admin/calendar/entries", { params: { year } });
    if (res.data && Array.isArray(res.data.entries)) {
      return res.data.entries;
    }
    return Array.isArray(res.data) ? res.data : [];
  },
  async setAdminOverride(date: string, college_status: boolean, reason?: string): Promise<AdminOverrideResponse> {
    const res = await api.put<AdminOverrideResponse>(`/admin/calendar/${date}`, {
      college_status,
      reason,
    });
    return res.data;
  },
  async deleteAdminOverride(date: string): Promise<AdminOverrideResponse> {
    const res = await api.delete<AdminOverrideResponse>(`/admin/calendar/${date}`);
    return res.data;
  },
  async syncHolidays(year?: number): Promise<{ message: string; count: number; source_status: any }> {
    const res = await api.post("/admin/calendar/sync", null, { params: { year } });
    return res.data;
  },
};


// Authoritative System Clock Service
export const systemService = {
  async getEmailMode(): Promise<{
    email_provider: string;
    is_mock: boolean;
    mode_notice: string;
  }> {
    const res = await api.get("/system/email-mode");
    return res.data;
  },
  async getNow(): Promise<{
    timezone: string;
    utc_now: string;
    local_now: string;
    local_date: string;
    local_time: string;
    day_of_week: string;
    current_year: number;
  }> {
    const res = await api.get("/system/now");
    return res.data;
  },
};
