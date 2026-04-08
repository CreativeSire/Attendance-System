import { api } from './client';
import { normalizePayroll } from './normalizers';
import type { PayrollCalculation, ApiResponse, PaginatedResponse } from '@/types';

export const payrollApi = {
  getMyPayroll: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<PayrollCalculation>>(`/payroll/my?${query.toString()}`).then((res) => ({ ...res, data: normalizePayroll(res.data as unknown as Record<string, unknown>) }));
  },

  getTeamPayroll: (params?: { month?: number; year?: number; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<PayrollCalculation>>>(`/payroll/team?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizePayroll), total: 0, page: 1, limit: 100, totalPages: 1 },
    }));
  },

  calculate: (userId: string, month: number, year: number) =>
    api.post<ApiResponse<PayrollCalculation>>('/payroll/calculate', { userId, month, year }),

  calculateAll: (month: number, year: number) =>
    api.post<ApiResponse<PayrollCalculation[]>>('/payroll/calculate-all', { month, year }),
};
