import { api } from './client';
import { normalizePerformanceGoal } from './normalizers';
import type { PerformanceGoal, ApiResponse } from '@/types';

export interface CreateGoalData {
  title: string;
  description?: string;
  targetDate: string;
  quarter: string;
  year: number;
  keyResults: { title: string; target: number; unit?: string }[];
}

export const performanceApi = {
  getMyGoals: (params?: { quarter?: string; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.quarter) query.set('quarter', params.quarter);
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<PerformanceGoal[]>>(`/performance/my-goals?${query.toString()}`).then((res) => ({
      ...res,
      data: (res.data as unknown as Record<string, unknown>[]).map(normalizePerformanceGoal),
    }));
  },

  getTeamGoals: (params?: { quarter?: string; year?: number; userId?: string }) => {
    const query = new URLSearchParams();
    if (params?.quarter) query.set('quarter', params.quarter);
    if (params?.year) query.set('year', String(params.year));
    if (params?.userId) query.set('userId', params.userId);
    return api.get<ApiResponse<PerformanceGoal[]>>(`/performance/team-goals?${query.toString()}`).then((res) => ({
      ...res,
      data: (res.data as unknown as Record<string, unknown>[]).map(normalizePerformanceGoal),
    }));
  },

  createGoal: (data: CreateGoalData) =>
    api.post<ApiResponse<PerformanceGoal>>('/performance/goals', {
      quarter: parseInt(data.quarter.replace('Q', ''), 10),
      year: data.year,
      objective: data.title,
      keyResultOne: data.keyResults[0]?.title,
      keyResultTwo: data.keyResults[1]?.title,
      keyResultThree: data.keyResults[2]?.title,
      progressPercent: 0,
    }).then((res) => ({ ...res, data: normalizePerformanceGoal(res.data as unknown as Record<string, unknown>) })),

  updateGoal: (id: string, data: Partial<CreateGoalData> & { progress?: number }) =>
    api.patch<ApiResponse<PerformanceGoal>>(`/performance/goals/${id}`, {
      objective: data.title,
      progressPercent: data.progress,
    }).then((res) => ({ ...res, data: normalizePerformanceGoal(res.data as unknown as Record<string, unknown>) })),

  updateKeyResult: (goalId: string, krId: string, current: number) =>
    api.patch<ApiResponse<PerformanceGoal>>(`/performance/goals/${goalId}/kr/${krId}`, { current }),

  getTeamPerformance: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<{
      userId: string;
      user: { name: string; department: string; avatar?: string };
      attendanceRate: number;
      bddCompletionRate: number;
      avgProgressScore: number;
      okrProgress: number;
      overallScore: number;
    }[]>>(`/performance/team?${query.toString()}`);
  },

  getMyPerformanceScore: () =>
    api.get<ApiResponse<{
      attendanceRate: number;
      bddCompletionRate: number;
      avgProgressScore: number;
      okrProgress: number;
      overallScore: number;
      streak: number;
    }>>('/performance/my-score'),
};
