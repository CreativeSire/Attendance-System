import { api } from './client';
import type { QRToken, EntryPoint, ApiResponse } from '@/types';

export const qrApi = {
  getEntryQR: (entryPointId: string) =>
    api.get<ApiResponse<{ token: string; qrDataUrl: string; expiresAt: string }>>(`/qr/entry/${entryPointId}`),

  getEntryToken: (entryPointId: string) =>
    api.get<ApiResponse<{ token: string; qrDataUrl: string; expiresAt: string }>>(`/qr/entry/${entryPointId}`),

  validateToken: (token: string) =>
    api.post<ApiResponse<{ valid: boolean; entryPointId: string; entryPoint: EntryPoint }>>('/qr/validate', { token }),

  getEntryPoints: () =>
    api.get<ApiResponse<EntryPoint[]>>('/qr/entry-points'),

  createEntryPoint: (data: { name: string; location: string; description?: string }) =>
    api.post<ApiResponse<EntryPoint>>('/qr/entry-points', data),

  updateEntryPoint: (id: string, data: { name?: string; location?: string; description?: string; active?: boolean }) =>
    api.patch<ApiResponse<EntryPoint>>(`/qr/entry-points/${id}`, data),

  deleteEntryPoint: (id: string) =>
    api.del<ApiResponse<null>>(`/qr/entry-points/${id}`),

  getCurrentTokens: () =>
    api.get<ApiResponse<QRToken[]>>('/qr/current-tokens'),
};
