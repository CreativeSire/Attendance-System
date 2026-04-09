import type {
  AttendanceRecord,
  AttendanceVerification,
  BroadcastMessage,
  ExpenseRequest,
  FaceEnrollment,
  LeaveRequest,
  Notification,
  OfficeZone,
  PayrollCalculation,
  PerformanceGoal,
  ReviewQueueItem,
  User,
} from '@/types';

export function normalizeRole(role?: string | null): User['role'] {
  if (role === 'admin' || role === 'manager' || role === 'employee') return role;
  return 'employee';
}

export function toStatusLabel(status?: string | null) {
  return String(status || '').toUpperCase();
}

export function normalizeUser(input: Record<string, unknown>): User {
  return {
    id: String(input.id),
    email: String(input.email || ''),
    name: String(input.name || ''),
    role: normalizeRole(typeof input.role === 'string' ? input.role : undefined),
    department: String(input.department || 'General'),
    position: String(input.position || 'Employee'),
    phone: typeof input.phone === 'string' ? input.phone : undefined,
    employeeId: typeof input.employeeId === 'string' ? input.employeeId : undefined,
    masterPhotoUrl: typeof input.masterPhoto === 'string'
      ? input.masterPhoto
      : typeof input.masterPhotoUrl === 'string'
        ? input.masterPhotoUrl
        : undefined,
    annualLeaveBalance: Number(input.annualLeaveBalance || 0),
    sickLeaveBalance: Number(input.sickLeaveBalance || 0),
    casualLeaveBalance: Number(input.casualLeaveBalance || 0),
    hasPin: Boolean(input.hasPin ?? input.pinHash),
    hasFaceEnrollment: Boolean(input.hasFaceEnrollment ?? input.masterPhoto ?? input.masterPhotoUrl),
    appearanceProfile: input.appearanceProfile && typeof input.appearanceProfile === 'object'
      ? input.appearanceProfile as Record<string, unknown>
      : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

export function normalizeAttendanceVerification(input: Record<string, unknown>): AttendanceVerification {
  return {
    id: String(input.id || ''),
    riskScore: Number(input.riskScore || 0),
    decision: String(input.decision || 'approved') as AttendanceVerification['decision'],
    reasons: Array.isArray(input.reasons)
      ? input.reasons.map((item) => String(item))
      : Array.isArray(input.riskReasons)
        ? (input.riskReasons as unknown[]).map((item) => String(item))
        : [],
    reviewStatus: String(input.reviewStatus || 'pending') as AttendanceVerification['reviewStatus'],
    aiSummary: typeof input.aiSummary === 'string' ? input.aiSummary : undefined,
    aiRecommendation: typeof input.aiRecommendation === 'string' ? input.aiRecommendation : undefined,
    aiModel: typeof input.aiModel === 'string' ? input.aiModel : undefined,
    faceDistance: typeof input.faceDistance === 'number' ? input.faceDistance : null,
  };
}

export function normalizeAttendance(input: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(input.id),
    userId: String(input.userId),
    user: input.user && typeof input.user === 'object'
      ? normalizeUser(input.user as Record<string, unknown>)
      : undefined,
    date: String(input.date),
    clockIn: typeof input.clockIn === 'string'
      ? input.clockIn
      : typeof input.clockInTime === 'string'
        ? input.clockInTime
        : undefined,
    clockOut: typeof input.clockOut === 'string'
      ? input.clockOut
      : typeof input.clockOutTime === 'string'
        ? input.clockOutTime
        : undefined,
    status: toStatusLabel(typeof input.status === 'string' ? input.status : undefined) as AttendanceRecord['status'],
    entryPoint: input.entryPoint && typeof input.entryPoint === 'object'
      ? input.entryPoint as AttendanceRecord['entryPoint']
      : typeof input.entryPoint === 'string'
        ? { id: '', name: String(input.entryPoint), location: '', active: true, createdAt: '' }
        : undefined,
    lateReason: typeof input.lateReason === 'string' ? input.lateReason : undefined,
    faceVerified: Boolean(input.faceVerified ?? input.clockInPhoto),
    qrVerified: Boolean(input.qrVerified ?? (input.clockInMethod === 'qr')),
    workHours: Number(input.workHours ?? input.totalHours ?? 0),
    overtimeHours: Number(input.overtimeHours ?? 0),
    bddSubmitted: Boolean(input.bddSubmitted),
    mood: typeof input.mood === 'string' ? input.mood : undefined,
    locationStatus: typeof input.locationStatus === 'string' ? input.locationStatus : undefined,
    distanceFromOffice: typeof input.distanceFromOffice === 'number' ? input.distanceFromOffice : null,
    reviewDecision: typeof input.reviewDecision === 'string' ? input.reviewDecision as AttendanceRecord['reviewDecision'] : undefined,
    verificationMethod: typeof input.verificationMethod === 'string' ? input.verificationMethod as AttendanceRecord['verificationMethod'] : undefined,
    reviewReasons: Array.isArray(input.reviewReasons) ? input.reviewReasons.map((item) => String(item)) : undefined,
    verification: input.verification && typeof input.verification === 'object'
      ? normalizeAttendanceVerification(input.verification as Record<string, unknown>)
      : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

export function normalizeFaceEnrollment(input: Record<string, unknown>): FaceEnrollment {
  return {
    id: String(input.id || ''),
    userId: String(input.userId || ''),
    version: Number(input.version || 1),
    qualityScore: Number(input.qualityScore || 0),
    isActive: Boolean(input.isActive),
    appearanceMetadata: input.appearanceMetadata && typeof input.appearanceMetadata === 'object'
      ? input.appearanceMetadata as Record<string, unknown>
      : undefined,
    images: Array.isArray(input.images)
      ? input.images.map((image) => ({
          id: typeof (image as Record<string, unknown>).id === 'string' ? String((image as Record<string, unknown>).id) : undefined,
          kind: String((image as Record<string, unknown>).kind || 'front'),
          imageRef: String((image as Record<string, unknown>).imageRef || ''),
          qualityScore: typeof (image as Record<string, unknown>).qualityScore === 'number'
            ? Number((image as Record<string, unknown>).qualityScore)
            : undefined,
          descriptor: Array.isArray((image as Record<string, unknown>).descriptor)
            ? ((image as Record<string, unknown>).descriptor as unknown[]).map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
            : undefined,
          captureMetadata: (image as Record<string, unknown>).captureMetadata && typeof (image as Record<string, unknown>).captureMetadata === 'object'
            ? (image as Record<string, unknown>).captureMetadata as Record<string, unknown>
            : undefined,
        }))
      : [],
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : undefined,
  };
}

export function normalizeOfficeZone(input: Record<string, unknown>): OfficeZone {
  return {
    id: String(input.id || ''),
    officeLocationId: String(input.officeLocationId || ''),
    officeLocation: input.officeLocation && typeof input.officeLocation === 'object'
      ? {
          id: String((input.officeLocation as Record<string, unknown>).id || ''),
          name: String((input.officeLocation as Record<string, unknown>).name || ''),
          address: String((input.officeLocation as Record<string, unknown>).address || ''),
          latitude: Number((input.officeLocation as Record<string, unknown>).latitude || 0),
          longitude: Number((input.officeLocation as Record<string, unknown>).longitude || 0),
          radiusMeters: Number((input.officeLocation as Record<string, unknown>).radiusMeters || 0),
          isActive: Boolean((input.officeLocation as Record<string, unknown>).isActive ?? true),
        }
      : undefined,
    name: String(input.name || ''),
    type: String(input.type || 'work_zone') as OfficeZone['type'],
    centerLat: Number(input.centerLat || 0),
    centerLng: Number(input.centerLng || 0),
    radiusMeters: Number(input.radiusMeters || 0),
    geometry: input.geometry && typeof input.geometry === 'object'
      ? input.geometry as Record<string, unknown>
      : undefined,
    allowedForAttendance: Boolean(input.allowedForAttendance ?? true),
    riskWeight: Number(input.riskWeight || 0),
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : undefined,
  };
}

export function normalizeReviewQueueItem(input: Record<string, unknown>): ReviewQueueItem {
  return {
    id: String(input.id || ''),
    attendanceVerificationId: String(input.attendanceVerificationId || ''),
    attendanceRecordId: typeof input.attendanceRecordId === 'string' ? input.attendanceRecordId : undefined,
    userId: String(input.userId || ''),
    user: input.user && typeof input.user === 'object'
      ? normalizeUser(input.user as Record<string, unknown>)
      : undefined,
    attendanceVerification: input.attendanceVerification && typeof input.attendanceVerification === 'object'
      ? normalizeAttendanceVerification(input.attendanceVerification as Record<string, unknown>)
      : undefined,
    riskScore: Number(input.riskScore || 0),
    status: String(input.status || 'pending') as ReviewQueueItem['status'],
    recommendation: String(input.recommendation || ''),
    reasons: Array.isArray(input.reasons) ? input.reasons.map((item) => String(item)) : [],
    aiRecommendation: typeof input.aiRecommendation === 'string' ? input.aiRecommendation : undefined,
    aiRiskSummary: typeof input.aiRiskSummary === 'string' ? input.aiRiskSummary : undefined,
    reviewNote: typeof input.reviewNote === 'string' ? input.reviewNote : undefined,
    reviewedBy: typeof input.reviewedBy === 'string' ? input.reviewedBy : undefined,
    reviewedAt: typeof input.reviewedAt === 'string' ? input.reviewedAt : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
  };
}

export function normalizeLeave(input: Record<string, unknown>): LeaveRequest {
  return {
    id: String(input.id),
    userId: String(input.userId),
    user: input.user && typeof input.user === 'object'
      ? normalizeUser(input.user as Record<string, unknown>)
      : undefined,
    type: String(input.type || '').toUpperCase() as LeaveRequest['type'],
    startDate: String(input.startDate),
    endDate: String(input.endDate),
    days: Number(input.days || 0),
    reason: String(input.reason || ''),
    status: toStatusLabel(typeof input.status === 'string' ? input.status : undefined) as LeaveRequest['status'],
    approvedBy: typeof input.approvedBy === 'string' ? input.approvedBy : undefined,
    approvalNote: typeof input.reviewNote === 'string' ? input.reviewNote : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

export function normalizeExpense(input: Record<string, unknown>): ExpenseRequest {
  return {
    id: String(input.id),
    userId: String(input.userId),
    user: input.user && typeof input.user === 'object'
      ? normalizeUser(input.user as Record<string, unknown>)
      : undefined,
    title: String(input.title || ''),
    amount: Number(input.amount || 0),
    category: String(input.category || '').toUpperCase() as ExpenseRequest['category'],
    date: String(input.date),
    description: typeof input.description === 'string' ? input.description : undefined,
    receiptUrl: typeof input.receipt === 'string'
      ? input.receipt
      : typeof input.receiptUrl === 'string'
        ? input.receiptUrl
        : undefined,
    status: toStatusLabel(typeof input.status === 'string' ? input.status : undefined) as ExpenseRequest['status'],
    approvedBy: typeof input.approvedBy === 'string' ? input.approvedBy : undefined,
    approvalNote: typeof input.reviewNote === 'string' ? input.reviewNote : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

export function normalizePayroll(input: Record<string, unknown>): PayrollCalculation {
  const lineItems = Array.isArray(input.lineItems) ? input.lineItems as Array<Record<string, unknown>> : [];
  const additions = lineItems
    .filter((item) => item.type === 'earning' && item.label !== 'Basic Salary')
    .map((item) => ({ name: String(item.label), amount: Number(item.amount || 0) }));
  const deductions = lineItems
    .filter((item) => item.type === 'deduction')
    .map((item) => ({ name: String(item.label), amount: Number(item.amount || 0) }));

  return {
    id: `${input.userId}-${input.month}-${input.year}`,
    userId: String(input.userId),
    user: {
      id: String(input.userId),
      email: '',
      name: String(input.name || ''),
      role: 'employee',
      department: String(input.department || 'General'),
      position: '',
      annualLeaveBalance: 0,
      sickLeaveBalance: 0,
      casualLeaveBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    month: Number(input.month || 0),
    year: Number(input.year || 0),
    baseSalary: Number(input.basicSalary || 0),
    workingDays: Number(input.workingDays || 0),
    presentDays: Number(input.presentDays || 0),
    overtimeHours: Number(input.overtimeHours || 0),
    overtimePay: additions.find((item) => item.name === 'Overtime Pay')?.amount || 0,
    deductions,
    additions,
    tax: Number(input.paye || 0),
    netPay: Number(input.netPay || 0),
    grossPay: Number(input.grossPay || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizePerformanceGoal(input: Record<string, unknown>): PerformanceGoal {
  const keyResults = [
    input.keyResultOne ? { id: `${input.id}-kr1`, goalId: String(input.id), title: String(input.keyResultOne), progress: Number(input.progressPercent || 0), target: 100, current: Number(input.progressPercent || 0), unit: '%' } : null,
    input.keyResultTwo ? { id: `${input.id}-kr2`, goalId: String(input.id), title: String(input.keyResultTwo), progress: Number(input.progressPercent || 0), target: 100, current: Number(input.progressPercent || 0), unit: '%' } : null,
    input.keyResultThree ? { id: `${input.id}-kr3`, goalId: String(input.id), title: String(input.keyResultThree), progress: Number(input.progressPercent || 0), target: 100, current: Number(input.progressPercent || 0), unit: '%' } : null,
  ].filter(Boolean) as PerformanceGoal['keyResults'];

  const quarter = Number(input.quarter || 1);
  const year = Number(input.year || new Date().getFullYear());

  return {
    id: String(input.id),
    userId: String(input.userId),
    user: input.user && typeof input.user === 'object'
      ? normalizeUser(input.user as Record<string, unknown>)
      : undefined,
    title: String(input.objective || input.title || ''),
    description: typeof input.managerNotes === 'string' ? input.managerNotes : undefined,
    targetDate: `${year}-${String((quarter - 1) * 3 + 3).padStart(2, '0')}-28`,
    progress: Number(input.progressPercent || 0),
    keyResults,
    quarter: `Q${quarter}`,
    year,
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

export function normalizeNotification(input: Record<string, unknown>): Notification {
  return {
    id: String(input.id),
    userId: String(input.userId),
    title: String(input.title || ''),
    message: String(input.message || ''),
    type: toStatusLabel(typeof input.type === 'string' ? input.type : 'INFO') as Notification['type'],
    read: Boolean(input.read),
    link: typeof input.link === 'string' ? input.link : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
  };
}

export function normalizeBroadcast(input: Record<string, unknown>): BroadcastMessage {
  return {
    id: String(input.id),
    title: String(input.title || ''),
    message: String(input.message || ''),
    createdBy: String(input.createdBy || input.senderId || ''),
    priority: 'MEDIUM',
    expiresAt: typeof input.expiresAt === 'string' ? input.expiresAt : undefined,
    targetDepartment: typeof input.targetDepartment === 'string' ? input.targetDepartment : undefined,
    createdAt: String(input.createdAt || new Date().toISOString()),
  };
}
