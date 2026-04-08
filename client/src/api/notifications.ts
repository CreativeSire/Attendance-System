import { api } from './client';
import { normalizeBroadcast, normalizeNotification } from './normalizers';
import type { Notification, ApiResponse, BroadcastMessage } from '@/types';

export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return api.get<ApiResponse<Notification[]>>(`/notifications?${query.toString()}`).then((res) => {
      const payload = res.data as unknown as { notifications?: Record<string, unknown>[] };
      return {
        ...res,
        data: (payload.notifications || []).map(normalizeNotification),
      };
    });
  },

  markRead: (id: string) =>
    api.patch<ApiResponse<Notification>>(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    api.patch<ApiResponse<null>>('/notifications/read-all', {}),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/notifications').then((res) => {
      const payload = res.data as unknown as { unreadCount?: number };
      return { ...res, data: { count: payload.unreadCount || 0 } };
    }),

  getBroadcasts: () =>
    api.get<ApiResponse<BroadcastMessage[]>>('/broadcasts').then((res) => ({
      ...res,
      data: (res.data as unknown as Record<string, unknown>[]).map(normalizeBroadcast),
    })),

  createBroadcast: (data: { title: string; message: string; priority: string; targetDepartment?: string; expiresAt?: string }) =>
    api.post<ApiResponse<BroadcastMessage>>('/broadcasts', data).then((res) => ({ ...res, data: normalizeBroadcast(res.data as unknown as Record<string, unknown>) })),

  deleteBroadcast: (id: string) =>
    api.del<ApiResponse<null>>(`/broadcasts/${id}`),
};
