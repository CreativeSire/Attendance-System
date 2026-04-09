import { api } from './client';
import { normalizeUser } from './normalizers';
import type { User, ApiResponse } from '@/types';

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: string;
  department?: string;
  position?: string;
  phone?: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    return {
      ...res,
      data: {
        ...res.data,
        user: normalizeUser(res.data.user as unknown as Record<string, unknown>),
      },
    };
  },

  logout: () => api.post<ApiResponse<null>>('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>('/auth/refresh', { refreshToken }),

  me: async () => {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return { ...res, data: normalizeUser(res.data as unknown as Record<string, unknown>) };
  },

  register: (data: RegisterData) =>
    api.post<ApiResponse<LoginResponse>>('/auth/register', data),

  updateProfile: (data: Partial<User> & { password?: string }) =>
    api.patch<ApiResponse<User>>('/auth/profile', data),

  setupPin: (pin: string) =>
    api.post<ApiResponse<null>>('/auth/pin/setup', { pin }),

  resetPin: (userId: string, pin: string) =>
    api.post<ApiResponse<null>>(`/auth/pin/reset/${userId}`, { pin }),

  getFaceEnrollment: async () => {
    const res = await api.get<ApiResponse<unknown>>('/auth/face-enrollment');
    return res;
  },

  saveFaceEnrollment: (payload: {
    images: Array<{ kind: string; imageRef: string; qualityScore?: number }>;
    appearanceMetadata?: Record<string, unknown>;
  }) =>
    api.post<ApiResponse<unknown>>('/auth/face-enrollment', payload),

  uploadMasterPhoto: (photoBase64: string) =>
    api.post<ApiResponse<{ url: string }>>('/auth/master-photo', { photo: photoBase64 }),
};
