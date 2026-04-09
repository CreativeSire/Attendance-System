import { api } from './client';
import { normalizeAttendance, normalizeReviewQueueItem } from './normalizers';
import { getDeviceFingerprint, getDeviceLabel } from '@/lib/device';
import type {
  AttendanceRecord,
  AttendanceStats,
  ApiResponse,
  PaginatedResponse,
  CorrectionRequest,
  LivenessResponse,
  OfficeZone,
  ReviewQueueItem,
  VerificationSession,
} from '@/types';

export interface ClockInData {
  qrToken: string;
  facePhoto?: string;
  lateReason?: string;
  mood?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export interface ClockOutData {
  facePhoto?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export interface VerificationStartData {
  pin: string;
  workMode?: 'office' | 'wfh' | 'field' | 'client_site';
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export interface VerificationCompleteData {
  sessionId: string;
  facePhoto: string;
  lateReason?: string;
  mood?: string;
  livenessResponses: LivenessResponse[];
}

export const attendanceApi = {
  clockIn: async (data: ClockInData) => {
    const res = await api.post<ApiResponse<AttendanceRecord>>('/attendance/clock-in', data);
    return { ...res, data: normalizeAttendance(res.data as unknown as Record<string, unknown>) };
  },

  clockOut: async (data: ClockOutData) => {
    const res = await api.post<ApiResponse<AttendanceRecord>>('/attendance/clock-out', data);
    return { ...res, data: normalizeAttendance(res.data as unknown as Record<string, unknown>) };
  },

  startVerification: async (data: VerificationStartData) => {
    const res = await api.post<ApiResponse<VerificationSession>>('/attendance/verification/start', {
      ...data,
      deviceFingerprint: getDeviceFingerprint(),
      deviceLabel: getDeviceLabel(),
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    });
    return res;
  },

  completeVerification: async (data: VerificationCompleteData) => {
    const res = await api.post<ApiResponse<AttendanceRecord>>('/attendance/verification/complete', data);
    return { ...res, data: normalizeAttendance(res.data as unknown as Record<string, unknown>) };
  },

  getMyAttendance: (params?: { month?: number; year?: number; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<AttendanceRecord>>>(`/attendance/my?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeAttendance), total: 0, page: 1, limit: 100, totalPages: 1 },
    }));
  },

  getTeamAttendance: (params?: {
    date?: string;
    month?: number;
    year?: number;
    userId?: string;
    department?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.userId) query.set('userId', params.userId);
    if (params?.department) query.set('department', params.department);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<AttendanceRecord>>>(`/attendance/team?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeAttendance), total: 0, page: 1, limit: 200, totalPages: 1 },
    }));
  },

  getTodayStats: () =>
    api.get<ApiResponse<AttendanceStats>>('/attendance/today-stats'),

  getLiveFeed: () =>
    api.get<ApiResponse<AttendanceRecord[]>>('/attendance/live-feed').then((res) => ({
      ...res,
      data: (res.data as unknown as Record<string, unknown>[]).map(normalizeAttendance),
    })),

  getTodayStatus: () =>
    api.get<ApiResponse<AttendanceRecord | null>>('/attendance/today-status').then((res) => ({
      ...res,
      data: res.data ? normalizeAttendance(res.data as unknown as Record<string, unknown>) : null,
    })),

  requestCorrection: (attendanceId: string, data: { reason: string; requestedClockIn?: string; requestedClockOut?: string }) =>
    api.post<ApiResponse<CorrectionRequest>>('/attendance/correction', { attendanceId, ...data }),

  getCorrections: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return api.get<ApiResponse<CorrectionRequest[]>>(`/attendance/corrections${query}`);
  },

  approveCorrection: (id: string) =>
    api.patch<ApiResponse<CorrectionRequest>>(`/attendance/corrections/${id}/approve`, {}),

  rejectCorrection: (id: string, reason: string) =>
    api.patch<ApiResponse<CorrectionRequest>>(`/attendance/corrections/${id}/reject`, { reason }),

  getMyStats: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<{
      presentDays: number;
      lateDays: number;
      absentDays: number;
      totalWorkHours: number;
      overtimeHours: number;
      attendanceRate: number;
    }>>(`/attendance/my-stats?${query.toString()}`);
  },

  getReviewQueue: async (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await api.get<ApiResponse<ReviewQueueItem[]>>(`/admin/review-queue${query}`);
    return {
      ...res,
      data: Array.isArray(res.data)
        ? (res.data as unknown as Record<string, unknown>[]).map(normalizeReviewQueueItem)
        : [],
    };
  },

  updateReviewQueue: (id: string, payload: { status: 'approved' | 'rejected' | 'escalated'; reviewNote?: string }) =>
    api.patch<ApiResponse<ReviewQueueItem>>(`/admin/review-queue/${id}`, payload),

  assistedClockIn: (payload: {
    employeeId: string;
    reasonCode: string;
    note?: string;
    workMode?: 'office' | 'wfh' | 'field' | 'client_site';
    lat?: number;
    lng?: number;
    accuracy?: number;
  }) => api.post<ApiResponse<AttendanceRecord>>('/admin/assisted-clock-in', payload),

  getZones: () => api.get<ApiResponse<OfficeZone[]>>('/admin/zones'),

  createZone: (payload: {
    officeLocationId: string;
    name: string;
    type: OfficeZone['type'];
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
    allowedForAttendance?: boolean;
    riskWeight?: number;
  }) => api.post<ApiResponse<OfficeZone>>('/admin/zones', payload),

  updateZone: (id: string, payload: Partial<Pick<OfficeZone, 'name' | 'type' | 'centerLat' | 'centerLng' | 'radiusMeters' | 'allowedForAttendance' | 'riskWeight'>>) =>
    api.patch<ApiResponse<OfficeZone>>(`/admin/zones/${id}`, payload),
};
