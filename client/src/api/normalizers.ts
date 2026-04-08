import type {
  AttendanceRecord,
  BroadcastMessage,
  ExpenseRequest,
  LeaveRequest,
  Notification,
  PayrollCalculation,
  PerformanceGoal,
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
    masterPhotoUrl: typeof input.masterPhoto === 'string'
      ? input.masterPhoto
      : typeof input.masterPhotoUrl === 'string'
        ? input.masterPhotoUrl
        : undefined,
    annualLeaveBalance: Number(input.annualLeaveBalance || 0),
    sickLeaveBalance: Number(input.sickLeaveBalance || 0),
    casualLeaveBalance: Number(input.casualLeaveBalance || 0),
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
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
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || input.createdAt || new Date().toISOString()),
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
