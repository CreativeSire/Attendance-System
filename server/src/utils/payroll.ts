import { PrismaClient } from '@prisma/client';

interface PayrollLineItem {
  label: string;
  amount: number;
  type: 'earning' | 'deduction';
}

export interface PayrollResult {
  userId: string;
  employeeId: string;
  name: string;
  department: string | null;
  month: number;
  year: number;
  basicSalary: number;
  hourlyRate: number;
  workingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  wfhDays: number;
  totalLateMinutes: number;
  overtimeHours: number;
  approvedLeaves: number;
  approvedExpenses: number;
  grossPay: number;
  lateDeduction: number;
  absentDeduction: number;
  pension: number;
  nhf: number;
  paye: number;
  totalDeductions: number;
  netPay: number;
  lineItems: PayrollLineItem[];
}

function getWorkingDaysInMonth(month: number, year: number): number {
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

export async function calculatePayroll(
  userId: string,
  month: number,
  year: number,
  prismaInstance: PrismaClient
): Promise<PayrollResult> {
  const user = await prismaInstance.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      employeeId: true,
      department: true,
      basicSalary: true,
      hourlyRate: true,
    },
  });

  const monthStr = month.toString().padStart(2, '0');
  const datePattern = `${year}-${monthStr}`;

  const attendanceRecords = await prismaInstance.attendanceRecord.findMany({
    where: {
      userId,
      date: { startsWith: datePattern },
    },
  });

  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let wfhDays = 0;
  let totalLateMinutes = 0;
  let overtimeHours = 0;

  for (const record of attendanceRecords) {
    if (record.status === 'absent') {
      absentDays++;
    } else if (record.status === 'wfh') {
      wfhDays++;
      presentDays++;
    } else {
      presentDays++;
    }
    if (record.isLate) {
      lateDays++;
      totalLateMinutes += record.lateMinutes;
    }
    overtimeHours += record.overtimeHours;
  }

  // Approved leaves for the month
  const leaveRequests = await prismaInstance.leaveRequest.findMany({
    where: {
      userId,
      status: 'approved',
      startDate: { startsWith: datePattern },
    },
  });
  const approvedLeaves = leaveRequests.reduce((sum, l) => sum + l.days, 0);

  // Approved expense reimbursements for month
  const expenses = await prismaInstance.expenseRequest.findMany({
    where: {
      userId,
      status: 'approved',
      date: { startsWith: datePattern },
    },
  });
  const approvedExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const workingDays = getWorkingDaysInMonth(month, year);

  // Daily rate from basic salary
  const dailyRate = user.basicSalary / workingDays;

  // Deductions
  const lateDeduction = (totalLateMinutes / 60) * user.hourlyRate;
  const absentDeduction = absentDays * dailyRate;

  // Overtime addition (1.5x hourly rate)
  const overtimePay = overtimeHours * user.hourlyRate * 1.5;

  const grossPay = user.basicSalary + overtimePay + approvedExpenses;

  // Nigerian statutory deductions
  const pension = user.basicSalary * 0.08; // 8% of basic
  const nhf = user.basicSalary * 0.025;   // 2.5% of basic

  // PAYE: 7% if annual > 300,000
  const annualSalary = user.basicSalary * 12;
  const paye = annualSalary > 300000 ? grossPay * 0.07 : 0;

  const totalDeductions = lateDeduction + absentDeduction + pension + nhf + paye;
  const netPay = Math.max(0, grossPay - totalDeductions);

  const lineItems: PayrollLineItem[] = [
    { label: 'Basic Salary', amount: user.basicSalary, type: 'earning' },
    { label: 'Overtime Pay', amount: overtimePay, type: 'earning' },
    { label: 'Expense Reimbursements', amount: approvedExpenses, type: 'earning' },
    { label: 'Late Deduction', amount: lateDeduction, type: 'deduction' },
    { label: 'Absent Deduction', amount: absentDeduction, type: 'deduction' },
    { label: 'Pension (8%)', amount: pension, type: 'deduction' },
    { label: 'NHF (2.5%)', amount: nhf, type: 'deduction' },
    { label: 'PAYE Tax (7%)', amount: paye, type: 'deduction' },
  ];

  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.name,
    department: user.department,
    month,
    year,
    basicSalary: user.basicSalary,
    hourlyRate: user.hourlyRate,
    workingDays,
    presentDays,
    lateDays,
    absentDays,
    wfhDays,
    totalLateMinutes,
    overtimeHours,
    approvedLeaves,
    approvedExpenses,
    grossPay,
    lateDeduction,
    absentDeduction,
    pension,
    nhf,
    paye,
    totalDeductions,
    netPay,
    lineItems,
  };
}
