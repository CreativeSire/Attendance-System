export type UserRole = 'employee' | 'manager' | 'admin';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'WORK_FROM_HOME';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'ANNUAL' | 'SICK' | 'CASUAL' | 'MATERNITY' | 'PATERNITY' | 'UNPAID';
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExpenseCategory = 'TRAVEL' | 'MEALS' | 'ACCOMMODATION' | 'EQUIPMENT' | 'TRAINING' | 'OTHER';
export type BDDDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
export type VerificationDecision = 'approved' | 'flagged' | 'blocked';
export type ReviewQueueStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type OfficeZoneType =
  | 'entry_zone'
  | 'work_zone'
  | 'staff_quarters_zone'
  | 'admin_zone'
  | 'warehouse_zone'
  | 'restricted_zone';
export type LocationClassification =
  | 'inside_work_zone'
  | 'inside_entry_zone'
  | 'inside_staff_quarters_zone'
  | 'inside_restricted_zone'
  | 'inside_radius'
  | 'near_office'
  | 'far'
  | 'poor_accuracy'
  | 'unavailable';
export type LivenessChallengeType = 'blink_twice' | 'turn_left' | 'turn_right' | 'nod_slowly' | 'say_digits';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  position: string;
  phone?: string;
  avatar?: string;
  masterPhotoUrl?: string;
  employeeId?: string;
  managerId?: string;
  entryPointId?: string;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  casualLeaveBalance: number;
  hasPin?: boolean;
  hasFaceEnrollment?: boolean;
  appearanceProfile?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  user?: User;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: AttendanceStatus;
  entryPointId?: string;
  entryPoint?: EntryPoint;
  lateReason?: string;
  faceVerified: boolean;
  qrVerified: boolean;
  workHours?: number;
  overtimeHours?: number;
  bddSubmitted: boolean;
  mood?: string;
  locationStatus?: LocationClassification | string;
  distanceFromOffice?: number | null;
  reviewDecision?: VerificationDecision;
  verificationMethod?: 'qr_fallback' | 'pin_face_location' | 'admin_override';
  reviewReasons?: string[];
  verification?: AttendanceVerification;
  createdAt: string;
  updatedAt: string;
}

export interface FaceEnrollmentImage {
  id?: string;
  kind: string;
  imageRef: string;
  qualityScore?: number;
  descriptor?: number[];
  captureMetadata?: Record<string, unknown>;
}

export interface FaceEnrollment {
  id: string;
  userId: string;
  version: number;
  qualityScore: number;
  isActive: boolean;
  appearanceMetadata?: Record<string, unknown>;
  images: FaceEnrollmentImage[];
  createdAt: string;
  updatedAt?: string;
}

export interface VerificationPrompt {
  type: LivenessChallengeType;
  prompt: string;
}

export interface VerificationSessionLocation {
  status: LocationClassification | string;
  distanceFromOffice?: number | null;
  zoneType?: OfficeZoneType | null;
  zoneName?: string | null;
}

export interface VerificationRisk {
  score: number;
  reasons: string[];
}

export interface VerificationSession {
  sessionId: string;
  expiresAt: string;
  prompts: VerificationPrompt[];
  location: VerificationSessionLocation;
  risk: VerificationRisk;
  enrollmentReady: boolean;
}

export interface LivenessResponse {
  type: LivenessChallengeType;
  passed: boolean;
  spokenDigits?: string;
  confidence?: number;
  metrics?: Record<string, unknown>;
}

export interface AttendanceVerification {
  id: string;
  riskScore: number;
  decision: VerificationDecision;
  reasons: string[];
  reviewStatus: ReviewQueueStatus;
  aiSummary?: string;
  aiRecommendation?: string;
  aiModel?: string;
  faceDistance?: number | null;
}

export interface BDDCheckIn {
  id: string;
  userId: string;
  user?: User;
  date: string;
  dayType: BDDDay;
  // Monday fields
  weeklyGoal?: string;
  mondayPriority1?: string;
  mondayPriority2?: string;
  mondayPriority3?: string;
  resourcesNeeded?: string;
  potentialBlockers?: string;
  // Daily fields
  progressScore?: number;
  completedYesterday?: string;
  todayPriority1?: string;
  todayPriority2?: string;
  todayPriority3?: string;
  blockers?: string;
  // Saturday fields
  weeklyAchievement?: string;
  keyWins?: string;
  aiUsage?: string;
  nextWeekPriorities?: string;
  mood?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  user?: User;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
  approver?: User;
  approvalNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRequest {
  id: string;
  userId: string;
  user?: User;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  description?: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  approver?: User;
  approvalNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceGoal {
  id: string;
  userId: string;
  user?: User;
  title: string;
  description?: string;
  targetDate: string;
  progress: number;
  keyResults: KeyResult[];
  quarter: string;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface KeyResult {
  id: string;
  goalId: string;
  title: string;
  progress: number;
  target: number;
  current: number;
  unit?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface QRToken {
  id: string;
  token: string;
  entryPointId: string;
  entryPoint?: EntryPoint;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface EntryPoint {
  id: string;
  name: string;
  location: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface EntryQRCode {
  entryPointId: string;
  entryPointName: string;
  token: string;
  qrDataUrl: string;
  expiresAt: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive?: boolean;
}

export interface OfficeZone {
  id: string;
  officeLocationId: string;
  officeLocation?: OfficeLocation;
  name: string;
  type: OfficeZoneType;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  geometry?: Record<string, unknown>;
  allowedForAttendance: boolean;
  riskWeight: number;
  createdAt?: string;
}

export interface ReviewQueueItem {
  id: string;
  attendanceVerificationId: string;
  attendanceRecordId?: string;
  userId: string;
  user?: User;
  attendanceVerification?: AttendanceVerification;
  riskScore: number;
  status: ReviewQueueStatus;
  recommendation: string;
  reasons: string[];
  aiRecommendation?: string;
  aiRiskSummary?: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AdminSettings {
  appConfig: {
    id: string;
    workStartTime: string;
    gracePeriodMinutes: number;
    qrExpirySeconds: number;
    requireLocation: boolean;
    requireFaceCapture: boolean;
    requireLiveness: boolean;
    requireEmployeePin: boolean;
    latePenaltyMode: string;
  };
  officeLocations: OfficeLocation[];
}

export interface PayrollCalculation {
  id: string;
  userId: string;
  user?: User;
  month: number;
  year: number;
  baseSalary: number;
  workingDays: number;
  presentDays: number;
  overtimeHours: number;
  overtimePay: number;
  deductions: PayrollDeduction[];
  additions: PayrollAddition[];
  tax: number;
  netPay: number;
  grossPay: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollDeduction {
  name: string;
  amount: number;
}

export interface PayrollAddition {
  name: string;
  amount: number;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  createdBy: string;
  creator?: User;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  expiresAt?: string;
  targetDepartment?: string;
  createdAt: string;
}

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  total: number;
}

export interface DashboardData {
  todayStats: AttendanceStats;
  liveFeed: AttendanceRecord[];
  pendingLeaves: number;
  pendingExpenses: number;
  pendingCorrections: number;
  broadcasts: BroadcastMessage[];
  weeklyChart: WeeklyChartData[];
  bddCompletionRate: number;
}

export interface WeeklyChartData {
  day: string;
  present: number;
  late: number;
  absent: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CorrectionRequest {
  id: string;
  userId: string;
  user?: User;
  attendanceId: string;
  attendance?: AttendanceRecord;
  reason: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: string;
}
