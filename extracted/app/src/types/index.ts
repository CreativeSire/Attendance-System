export type UserRole = 'admin' | 'manager' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  employeeId: string;
  hourlyRate?: number;
  monthlySalary?: number; // Added for payroll calculations
  masterPhoto?: string; // Base64 registered face for AI matching
  officeLocation?: {
    lat: number;
    lng: number;
    radius: number; // in meters
    address: string;
  };
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave' | 'half_day' | 'pending_correction';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  clockIn?: {
    time: string;
    location: {
      lat: number;
      lng: number;
      address?: string;
    };
    method: 'gps' | 'qr' | 'manual';
    photo?: string; // Base64 selfie for Buddy Punching prevention
  };
  clockOut?: {
    time: string;
    location: {
      lat: number;
      lng: number;
      address?: string;
    };
    method: 'gps' | 'qr' | 'manual';
    photo?: string; // Base64 selfie
  };
  status: AttendanceStatus;
  totalHours: number;
  notes?: string;
  isLate?: boolean;
  lateMinutes?: number;
  lateReason?: string; // Task 3: Lateness Negotiator
  mood?: string; // Task 1: Mood Tracking
  correctionRequest?: {
    requestedTime: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
  };
  approvedBy?: string;
  approvedAt?: string;
}

export interface BroadcastMessage {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
  expiresAt: string;
}

export interface ExpenseRequest {
  id: string;
  userId: string;
  userName: string;
  date: string;
  amount: number;
  type: 'transport' | 'data' | 'other';
  reason: string;
  receiptUrl?: string; // For base64 or cloudinary
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'sick' | 'vacation' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface PayrollData {
  userId: string;
  userName: string;
  period: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  pensionDeduction: number;
  payeTax: number;
  lateDeductions: number;
  expensesReimbursed: number;
  hourlyRate: number;
  totalPay: number;
}

export interface QRSession {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  location: {
    lat: number;
    lng: number;
  };
}

export interface CompanySettings {
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  officeLocation: {
    lat: number;
    lng: number;
    radius: number;
    address: string;
  };
  qrCodeRefreshInterval: number; // in minutes
}
