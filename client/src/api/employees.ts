import { api } from './client';
import { normalizeUser } from './normalizers';
import type { User, ApiResponse, PaginatedResponse } from '@/types';

export interface CreateEmployeeData {
  email: string;
  password: string;
  name: string;
  role: string;
  department: string;
  position: string;
  phone?: string;
  managerId?: string;
  baseSalary?: number;
}

export interface UpdateEmployeeData {
  name?: string;
  role?: string;
  department?: string;
  position?: string;
  phone?: string;
  managerId?: string;
  baseSalary?: number;
  annualLeaveBalance?: number;
  sickLeaveBalance?: number;
  casualLeaveBalance?: number;
  masterPhoto?: string;
}

export const employeesApi = {
  getAll: (params?: { department?: string; role?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.department) query.set('department', params.department);
    if (params?.role) query.set('role', params.role);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<PaginatedResponse<User>>>(`/employees?${query.toString()}`).then((res) => ({
      ...res,
      data: { data: (res.data as unknown as Record<string, unknown>[]).map(normalizeUser), total: 0, page: 1, limit: 100, totalPages: 1 },
    }));
  },

  getById: (id: string) =>
    api.get<ApiResponse<User>>(`/employees/${id}`).then((res) => ({ ...res, data: normalizeUser(res.data as unknown as Record<string, unknown>) })),

  create: (data: CreateEmployeeData) =>
    api.post<ApiResponse<User>>('/employees', { ...data, role: data.role.toLowerCase() }).then((res) => ({ ...res, data: normalizeUser(res.data as unknown as Record<string, unknown>) })),

  update: (id: string, data: UpdateEmployeeData) =>
    api.patch<ApiResponse<User>>(`/employees/${id}`, { ...data, role: data.role?.toLowerCase() }).then((res) => ({ ...res, data: normalizeUser(res.data as unknown as Record<string, unknown>) })),

  delete: (id: string) =>
    api.del<ApiResponse<null>>(`/employees/${id}`),

  getDepartments: () =>
    api.get<ApiResponse<string[]>>('/employees/departments'),

  getEmployeeStats: (id: string, params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<{
      attendanceRate: number;
      bddCompletionRate: number;
      avgProgressScore: number;
      presentDays: number;
      lateDays: number;
      totalWorkHours: number;
    }>>(`/employees/${id}/stats?${query.toString()}`);
  },
};
