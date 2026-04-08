import { api } from './client';
import type { BDDCheckIn, ApiResponse } from '@/types';

export interface SubmitBDDData {
  // Monday
  weeklyGoal?: string;
  mondayPriority1?: string;
  mondayPriority2?: string;
  mondayPriority3?: string;
  resourcesNeeded?: string;
  potentialBlockers?: string;
  // Daily
  progressScore?: number;
  completedYesterday?: string;
  todayPriority1?: string;
  todayPriority2?: string;
  todayPriority3?: string;
  blockers?: string;
  // Saturday
  weeklyAchievement?: string;
  keyWins?: string;
  aiUsage?: string;
  nextWeekPriorities?: string;
  mood?: string;
}

export const bddApi = {
  submit: (data: SubmitBDDData) =>
    api.post<ApiResponse<BDDCheckIn>>('/bdd', data),

  getTodayBDD: () =>
    api.get<ApiResponse<BDDCheckIn | null>>('/bdd/today'),

  getMyBDDs: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<BDDCheckIn[]>>(`/bdd/my?${query.toString()}`);
  },

  getTeamBDDs: (params?: { date?: string; userId?: string }) => {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.userId) query.set('userId', params.userId);
    return api.get<ApiResponse<BDDCheckIn[]>>(`/bdd/team?${query.toString()}`);
  },

  getCompletionRate: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return api.get<ApiResponse<{ rate: number; completed: number; total: number }>>(`/bdd/completion-rate?${query.toString()}`);
  },
};
