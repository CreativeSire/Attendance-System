import { api } from './client';
import { normalizeLeave } from './normalizers';
import type { LeaveRequest, ApiResponse, PaginatedResponse } from '@/types';

export interface RequestLeaveData {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export const leavesApi = {
  request: (data: RequestLeaveData) =>
    api.post<ApiResponse<LeaveRequest>>('/leaves', { ...data, type: data.type.charAt(0) + data.type.slice(1).toLowerCase() }).then((res) => ({ ...res, data: normalizeLeave(res.data as unknown as Record<string, unknown>) })),

  getMyLeaves: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<LeaveRequest>>>(`/leaves?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeLeave), total: 0, page: 1, limit: 100, totalPages: 1 },
    }));
  },

  getTeamLeaves: (params?: { status?: string; month?: number; year?: number; userId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.userId) query.set('userId', params.userId);
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<LeaveRequest>>>(`/leaves/all?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeLeave), total: 0, page: 1, limit: 200, totalPages: 1 },
    }));
  },

  approve: (id: string, note?: string) =>
    api.patch<ApiResponse<LeaveRequest>>(`/leaves/${id}/approve`, { reviewNote: note }).then((res) => ({ ...res, data: normalizeLeave(res.data as unknown as Record<string, unknown>) })),

  reject: (id: string, note?: string) =>
    api.patch<ApiResponse<LeaveRequest>>(`/leaves/${id}/reject`, { reviewNote: note }).then((res) => ({ ...res, data: normalizeLeave(res.data as unknown as Record<string, unknown>) })),

  cancel: (id: string) =>
    api.patch<ApiResponse<LeaveRequest>>(`/leaves/${id}/cancel`, {}),

  getBalance: () =>
    api.get<ApiResponse<{ annual: number; sick: number; casual: number }>>('/leaves/balance'),
};
