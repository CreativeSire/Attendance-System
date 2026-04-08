export type UserRole = 'employee' | 'manager' | 'admin';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'WORK_FROM_HOME';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveType = 'ANNUAL' | 'SICK' | 'CASUAL' | 'MATERNITY' | 'PATERNITY' | 'UNPAID';
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExpenseCategory = 'TRAVEL' | 'MEALS' | 'ACCOMMODATION' | 'EQUIPMENT' | 'TRAINING' | 'OTHER';
export type BDDDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';

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
  managerId?: string;
  entryPointId?: string;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  casualLeaveBalance: number;
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
  createdAt: string;
  updatedAt: string;
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
