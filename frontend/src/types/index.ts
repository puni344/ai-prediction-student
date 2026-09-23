export type UserRole = "student" | "faculty" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_email_verified?: boolean;
  auth_provider?: string;
  profile_complete?: boolean;
  requires_profile_completion?: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
  full_name: string;
  is_email_verified?: boolean;
  auth_provider?: string;
  profile_complete?: boolean;
  requires_profile_completion?: boolean;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  roll_number: string | null;
  department: string;
  academic_year: string | null;
  program?: string | null;
  college_start?: string | null;
  college_end?: string | null;
  breakfast_start?: string | null;
  breakfast_duration?: number | null;
  lunch_start?: string | null;
  lunch_duration?: number | null;
  dinner_start?: string | null;
  dinner_duration?: number | null;
  break_reserve_minutes?: number | null;
  age: number;
  gender: string;
  attendance: number;
  study_hours: number;
  sleep_hours: number;
  assignments_completed: number;
  previous_grade: number;
  parent_education: string;
  internet_access: string;
  family_income: string;
  extra_classes: string;
  participation: number;
  updated_at: string;
}

export interface PredictionSimulationRequest {
  age?: number;
  gender?: string;
  attendance?: number;
  study_hours?: number;
  sleep_hours?: number;
  assignments_completed?: number;
  previous_grade?: number;
  parent_education?: string;
  internet_access?: string;
  family_income?: string;
  extra_classes?: string;
  participation?: number;
}

export interface SHAPContributor {
  feature: string;
  contribution: number;
}

export interface ModelComparisonItem {
  predicted_score: number;
  pass_fail?: string;
  pass_probability?: number | null;
}

export interface PredictionResponse {
  id: number;
  predicted_score: number;
  pass_fail: "Pass" | "Fail";
  pass_probability: number;
  confidence_score: number;
  risk_level: "LOW" | "MODERATE" | "HIGH";
  risk_index: number;
  risk_description: string;
  base_value: number;
  shap_consistency: boolean;
  top_positive: SHAPContributor[];
  top_negative: SHAPContributor[];
  model_comparison: Record<string, ModelComparisonItem>;
  performance_model?: string;
  pass_fail_model?: string;
  created_at: string;
}

export interface FacultyDashboardResponse {
  total_enrolled_students: number;
  students_with_predictions: number;
  high_risk_count: number;
  moderate_risk_count: number;
  low_risk_count: number;
  average_predicted_score: number | null;
  average_pass_probability: number | null;
  assigned_departments?: string[];
}

export interface FacultyStudentItem {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  roll_number: string | null;
  department: string;
  academic_year: string | null;
  program?: string | null;
  attendance: number;
  study_hours: number;
  latest_predicted_score: number | null;
  latest_pass_fail: string | null;
  latest_pass_probability: number | null;
  latest_risk_level: string | null;
  latest_risk_index: number | null;
  last_prediction_date: string | null;
}

export interface FacultyStudentListResponse {
  total: number;
  skip: number;
  limit: number;
  students: FacultyStudentItem[];
}

export interface FacultyStudentDetailResponse {
  profile: StudentProfile;
  full_name: string;
  email: string;
  latest_prediction: PredictionResponse | null;
  prediction_history: PredictionResponse[];
}

export interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  risk_level: string;
}

export interface FacultyAnalyticsResponse {
  total_predictions: number;
  average_predicted_score: number | null;
  average_pass_probability: number | null;
  risk_distribution: Record<string, number>;
  score_distribution: Record<string, number>;
  attendance_vs_score: ScatterPoint[];
  study_hours_vs_score: ScatterPoint[];
  assignments_vs_score: ScatterPoint[];
  correlations: {
    attendance: number | null;
    study_hours: number | null;
    assignments: number | null;
  };
}

export interface FacultyRiskItem {
  student_id: number;
  full_name: string;
  roll_number: string | null;
  department: string;
  risk_level: string;
  risk_index: number;
  risk_description: string;
  predicted_score: number;
  pass_fail: string;
  pass_probability: number;
  attendance: number;
  study_hours: number;
  last_prediction_date: string | null;
}

export interface FacultyRiskResponse {
  total_flagged: number;
  high_risk_count: number;
  moderate_risk_count: number;
  students: FacultyRiskItem[];
}


// =====================================================================
// Phase 5: AI Learning & AI Advisor Types
// =====================================================================
export interface StudyPlanBlock {
  start_time: string;
  end_time: string;
  activity: string;
  focus_area: string;
  duration_minutes: number;
  is_break: boolean;
}

export interface StudyPlanConstraints {
  available_minutes?: number;
  preferred_start_time?: string;
  max_session_minutes?: number;
  break_minutes?: number;
}

export interface RecommendationItem {
  id: string;
  title: string;
  reason: string;
  action: string;
  priority: "high" | "medium" | "low";
  priority_score: number;
  duration_minutes: number;
  source_factors: string[];
}

export interface RecommendationResponse {
  generated_at: string;
  prediction_context: {
    predicted_score: number;
    pass_probability: number;
    risk_level: string;
    risk_index: number;
    pass_fail?: string;
  };
  overall_priority_score: number;
  summary: string;
  recommendations: RecommendationItem[];
  study_plan: StudyPlanBlock[];
  source_factors: string[];
  ai_enhanced: boolean;
  ai_status: "live_gemini" | "live_provider" | "development_mock" | "deterministic_fallback" | "unavailable" | "deterministic_fallback" | "unavailable";
}

export interface ChatSession {
  id: number;
  student_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  context_used?: string[];
  created_at: string;
  capability_used?: string;
  ai_status?: string;
}

export interface EmailVerifyRequest {
  email: string;
  otp: string;
}

export interface ResendVerificationRequest {
  email: string;
  captcha_token?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  captcha_token?: string;
}

export interface VerifyResetOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  email: string;
  reset_token: string;
  new_password: string;
  confirm_password: string;
}

export interface GoogleAuthRequest {
  id_token: string;
}

export interface GenericMessageResponse {
  status: string;
  message: string;
  detail?: string;
  remaining_seconds?: number;
}


export interface ForgotPasswordResponse {
  success: boolean;
  next_step: "verify_reset_otp" | "no_account" | string;
  message: string;
}

export interface CompleteGoogleProfileRequest {
  roll_number: string;
  department: string;
}


// Admin Types
export interface AdminOverviewResponse {
  total_students: number;
  total_faculty: number;
  total_predictions: number;
  risk_distribution: Record<string, number>;
  average_predicted_score: number | null;
  average_pass_probability: number | null;
  students_by_department: Array<{ department: string; code: string; count: number }>;
  faculty_by_department: Array<{ department: string; code: string; count: number }>;
  department_performance: Array<{
    department: string;
    code: string;
    students: number;
    faculty: number;
    avg_score: number | null;
    high_risk_count: number;
  }>;
}

export interface AdminStudentItem {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  roll_number: string;
  department: string;
  academic_year: string | null;
  program?: string | null;
  attendance: number;
  study_hours: number;
  latest_predicted_score: number | null;
  latest_pass_fail: string | null;
  latest_pass_probability: number | null;
  latest_risk_level: string | null;
  latest_risk_index: number | null;
  last_prediction_date: string | null;
}

export interface AdminStudentListResponse {
  total: number;
  skip: number;
  limit: number;
  students: AdminStudentItem[];
}

export interface AdminFacultyItem {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  faculty_id: string | null;
  designation: string;
  department: string;
  assigned_departments: string[];
  created_at: string | null;
}

export interface AdminFacultyListResponse {
  total: number;
  skip: number;
  limit: number;
  faculty: AdminFacultyItem[];
}

export interface DepartmentSummary {
  id: number;
  code: string;
  name: string;
  student_count: number;
  faculty_count: number;
  is_active: boolean;
}

export interface CalendarBusyEvent {
  title: string;
  start_time: string;
  end_time: string;
  is_all_day?: boolean;
  is_holiday_suggestion?: boolean;
}

export interface DayStatusResponse {
  current_date: string;
  current_time: string;
  selected_date: string;
  day_of_week: string;
  timezone: string;
  is_sunday: boolean;
  is_holiday: boolean;
  holiday_label?: string | null;
  college_active: boolean;
  prediction_is_stale: boolean;
  prediction_stale_reason?: string | null;
  calendar_connected: boolean;
  calendar_events: CalendarBusyEvent[];
}

export interface TimetableValidationResult {
  valid: boolean;
  error_code?: string | null;
  errorCode?: string | null;
  error_type?: string | null;
  is_partial_preview?: boolean;
  shortfall_minutes?: number;
  required_study_minutes?: number;
  hard_occupied_minutes?: number;
  break_reserve_minutes?: number;
  remaining_flexible_minutes?: number;
  min_allowable_sleep_hours?: number;
  max_allowable_sleep_hours?: number;
  min_allowable_study_hours?: number;
  max_allowable_study_hours?: number;
  college_minutes: number;
  sleep_minutes: number;
  meal_minutes: number;
  breakfast_start?: string;
  breakfast_duration?: number;
  lunch_start?: string;
  lunch_duration?: number;
  dinner_start?: string;
  dinner_duration?: number;
  rest_minutes: number;
  available_minutes: number;
  available_study_minutes: number;
  requested_study_minutes: number;
  remaining_buffer_minutes?: number;
  total_requested_minutes: number;
  message: string;
}

export interface TimetablePreferences {
  college_start: string;
  college_end: string;
  daily_study_hours: number;
  sleep_hours: number;
  sleep_start: string;
  sleep_end: string;
  rest_minutes: number;
  meal_minutes: number;
  breakfast_start?: string;
  breakfast_duration?: number;
  lunch_start?: string;
  lunch_duration?: number;
  dinner_start?: string;
  dinner_duration?: number;
  break_reserve_minutes?: number;
  preferred_study_period: string;
  session_length_preference: string;
  profile_study_hours?: number | null;
  profile_sleep_hours?: number | null;
  day_of_week?: string | null;
  is_enabled?: boolean;
  custom_day_preferences?: any;
  selected_date?: string | null;
  is_holiday?: boolean | null;
  holiday_label?: string | null;
  calendar_events?: CalendarBusyEvent[];
  sleep_is_fixed?: boolean;
  min_sleep_hours?: number | null;
  max_sleep_hours?: number | null;
  min_study_hours?: number | null;
  max_study_hours?: number | null;
}

export interface TimetableBlock {
  start_time: string;
  end_time: string;
  activity: string;
  category: "sleep" | "college" | "study" | "meal" | "rest" | "routine" | string;
  duration_minutes: number;
  focus_area?: string | null;
}

export interface TimetableResponse {
  preferences: TimetablePreferences;
  validation: TimetableValidationResult;
  is_partial_preview?: boolean;
  infeasibility_reason?: string | null;
  summary: {
    college_hours: string;
    sleep_schedule: string;
    daily_study_target: string;
    scheduled_study_minutes: number;
    available_minutes: number;
    available_study_minutes: number;
    meal_duration: string;
    rest_duration: string;
    preferred_period: string;
    fits_within_24h?: boolean;
  };
  schedule: TimetableBlock[];
}


export interface DailySnapshotResponse {
  id: number;
  student_id: number;
  snapshot_date: string;
  snapshot_time: string;
  timezone: string;
  study_hours: number;
  attendance: number;
  sleep_hours: number;
  assignments_completed: number;
  participation: number;
  previous_grade: number;
  predicted_score: number;
  pass_probability: number;
  risk_level: "LOW" | "MODERATE" | "HIGH" | string;
  risk_index: number;
  risk_description?: string | null;
  shap_data: {
    main_positive_factors?: Array<{
      factor: string;
      technical_feature: string;
      impact: number;
      direction: string;
    }>;
    main_negative_factors?: Array<{
      factor: string;
      technical_feature: string;
      impact: number;
      direction: string;
    }>;
    base_performance?: number;
    plain_explanation?: string;
  };
  recommendation_data: {
    summary?: string;
    items?: Array<{
      focus_area: string;
      priority: string;
      title: string;
      reason: string;
      action: string;
    }>;
  };
  created_at: string;
  is_official_snapshot: boolean;
}

export interface BucketTrendItem {
  bucket_key: string;
  bucket_label: string;
  sub_label?: string;
  avg_predicted_score: number | null;
  avg_study_hours: number | null;
  avg_attendance: number | null;
  risk_level: string | null;
  snapshot_count: number;
  has_data?: boolean;
}

export interface SnapshotTrendResponse {
  view_type: "day" | "week" | "month" | "year" | "weekly" | "monthly" | "semester";
  total_days: number;
  avg_predicted_score: number;
  risk_distribution: Record<string, number>;
  study_hours_trend: Array<{
    date: string;
    study_hours: number;
    predicted_score: number;
    risk_level: string;
  }>;
  attendance_trend: Array<{
    date: string;
    attendance: number;
  }>;
  risk_transitions?: Array<{
    date: string;
    from_risk: string;
    to_risk: string;
  }>;
  high_risk_days_count?: number;
  improvement_pattern?: string;
  starting_predicted_score?: number | null;
  latest_predicted_score?: number | null;
  score_change?: number | null;
  study_consistency?: string;
  snapshots: DailySnapshotResponse[];
  bucket_trends?: BucketTrendItem[];
  formula_definitions?: Record<string, string>;
  data_sufficiency?: {
    status: "sufficient" | "insufficient" | "empty";
    message: string;
    available_days: number;
    minimum_required_days: number;
  };
}


// Academic Calendar & Day Resolution Types
export interface DayResolutionResponse {
  date: string;
  day_of_week: string;
  holiday: boolean;
  holiday_name?: string | null;
  holiday_source?: string | null;
  holiday_category?: string | null;
  is_optional_holiday: boolean;
  default_college: boolean;
  student_override: boolean;
  student_override_reason?: string | null;
  admin_override: boolean;
  admin_override_reason?: string | null;
  college_status: boolean;
  final_status: string;
  locked?: boolean;
  override_scope?: string | null;
}

export interface CalendarEntryResponse {
  date: string;
  name: string;
  category: string;
  source: string;
  is_public_holiday: boolean;
  is_default_no_college: boolean;
  description?: string | null;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: DayResolutionResponse[];
}

export interface CalendarYearResponse {
  year: number;
  entries: CalendarEntryResponse[];
  total_public_holidays: number;
  total_optional_holidays: number;
}

export interface StudentOverrideRequest {
  college_status: boolean;
  reason?: string;
}

export interface StudentOverrideResponse {
  date: string;
  override_type: string;
  college_status: boolean;
  reason?: string | null;
  message: string;
}

export interface AdminOverrideRequest {
  college_status: boolean;
  reason?: string;
}

export interface AdminOverrideResponse {
  date: string;
  override_type: string;
  college_status: boolean;
  reason?: string | null;
  created_by?: string | null;
  message: string;
}

export interface AdminCalendarEntry {
  date: string;
  name: string;
  category: string;
  source: string;
  is_public_holiday: boolean;
  is_default_no_college: boolean;
  student_override_count: number;
  locked?: boolean;
  admin_override?: {
    override_type: string;
    college_status: boolean;
    reason?: string | null;
    created_by?: string | null;
  } | null;
}

export interface TimetableSimulationRequest {
  date: string;
  college_start?: string;
  college_end?: string;
  study_hours?: number;
  sleep_hours?: number;
  sleep_start?: string;
  meal_count?: number;
  meal_duration_minutes?: number;
  rest_break_count?: number;
  rest_break_duration_minutes?: number;
  preferred_study_period?: string;
}

export interface TimetableCapacity {
  available_hours: number;
  requested_study_hours: number;
  remaining_buffer_hours: number;
  max_feasible_study_hours: number;
  college_hours: number;
  sleep_hours: number;
  meal_hours: number;
  rest_hours: number;
}

export interface TimetableTimelineBlock {
  start_time: string;
  end_time: string;
  activity: string;
  category: string;
  duration_minutes: number;
  focus_area?: string | null;
}

export interface TimetableConflict {
  type: string;
  message: string;
  blocks_involved: string[];
}

export interface TimetableSimulationResponse {
  feasible: boolean;
  date: string;
  day_status: DayResolutionResponse;
  capacity: TimetableCapacity;
  conflicts: TimetableConflict[];
  timeline: TimetableTimelineBlock[];
  feasibility_message: string;
  valid_study_options: number[];
}

export interface TimetableSaveRequest {
  simulation: TimetableSimulationRequest;
}

export interface TimetableSaveResponse {
  saved: boolean;
  date: string;
  message: string;
}
