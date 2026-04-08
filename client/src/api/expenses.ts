import { api } from './client';
import { normalizeExpense } from './normalizers';
import type { ExpenseRequest, ApiResponse, PaginatedResponse } from '@/types';

export interface CreateExpenseData {
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  receiptBase64?: string;
}

export const expensesApi = {
  create: (data: CreateExpenseData) =>
    api.post<ApiResponse<ExpenseRequest>>('/expenses', {
      ...data,
      category: data.category.toLowerCase(),
      receipt: data.receiptBase64,
      description: data.description || '',
    }).then((res) => ({ ...res, data: normalizeExpense(res.data as unknown as Record<string, unknown>) })),

  getMyExpenses: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<ExpenseRequest>>>(`/expenses?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeExpense), total: 0, page: 1, limit: 100, totalPages: 1 },
    }));
  },

  getTeamExpenses: (params?: { status?: string; month?: number; year?: number; userId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.userId) query.set('userId', params.userId);
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<ExpenseRequest>>>(`/expenses/all?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeExpense), total: 0, page: 1, limit: 200, totalPages: 1 },
    }));
  },

  approve: (id: string, note?: string) =>
    api.patch<ApiResponse<ExpenseRequest>>(`/expenses/${id}/approve`, { reviewNote: note }).then((res) => ({ ...res, data: normalizeExpense(res.data as unknown as Record<string, unknown>) })),

  reject: (id: string, note?: string) =>
    api.patch<ApiResponse<ExpenseRequest>>(`/expenses/${id}/reject`, { reviewNote: note }).then((res) => ({ ...res, data: normalizeExpense(res.data as unknown as Record<string, unknown>) })),

  getMonthlySummary: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<{ category: string; total: number }[]>>(`/expenses/summary?${query.toString()}`);
  },
};
