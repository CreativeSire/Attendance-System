import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, pattern = 'MMM d, yyyy'): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return 'Invalid date';
    return format(d, pattern);
  } catch {
    return 'Invalid date';
  }
}

export function formatTime(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '--:--';
    return format(d, 'HH:mm');
  } catch {
    return '--:--';
  }
}

export function formatDateTime(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return 'Invalid date';
    return format(d, 'MMM d, yyyy HH:mm');
  } catch {
    return 'Invalid date';
  }
}

export function formatTimeAgo(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatCurrency(amount: number, currency = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en').format(num);
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getDayOfWeek(): 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
  return days[new Date().getDay()];
}

export function isLate(threshold = '09:00'): boolean {
  const now = new Date();
  const [h, m] = threshold.split(':').map(Number);
  const thresholdDate = new Date();
  thresholdDate.setHours(h, m, 0, 0);
  return now > thresholdDate;
}

export function calculateWorkHours(clockIn: string, clockOut: string): number {
  try {
    const inTime = parseISO(clockIn);
    const outTime = parseISO(clockOut);
    const diffMs = outTime.getTime() - inTime.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  } catch {
    return 0;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'PRESENT': return 'text-success';
    case 'LATE': return 'text-warning';
    case 'ABSENT': return 'text-danger';
    case 'HALF_DAY': return 'text-yellow-400';
    case 'WORK_FROM_HOME': return 'text-blue-400';
    case 'APPROVED': return 'text-success';
    case 'REJECTED': return 'text-danger';
    case 'PENDING': return 'text-warning';
    default: return 'text-gray-400';
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'PRESENT': return 'bg-success/20 text-success';
    case 'LATE': return 'bg-warning/20 text-warning';
    case 'ABSENT': return 'bg-danger/20 text-danger';
    case 'HALF_DAY': return 'bg-yellow-400/20 text-yellow-400';
    case 'WORK_FROM_HOME': return 'bg-blue-400/20 text-blue-400';
    case 'APPROVED': return 'bg-success/20 text-success';
    case 'REJECTED': return 'bg-danger/20 text-danger';
    case 'PENDING': return 'bg-warning/20 text-warning';
    case 'CANCELLED': return 'bg-gray-400/20 text-gray-400';
    default: return 'bg-gray-400/20 text-gray-400';
  }
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const value = String(item[key]);
    return { ...groups, [value]: [...(groups[value] || []), item] };
  }, {} as Record<string, T[]>);
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
export const EXPENSE_CATEGORIES = ['TRAVEL', 'MEALS', 'ACCOMMODATION', 'EQUIPMENT', 'TRAINING', 'OTHER'];
