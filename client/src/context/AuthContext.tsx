import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '@/api/auth';
import { setToken, getToken } from '@/api/client';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedRefreshToken = localStorage.getItem('refreshToken');
      if (!savedRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await authApi.refresh(savedRefreshToken);
        const newToken = res.data.accessToken;
        setToken(newToken);
        setAccessToken(newToken);
        if (res.data.refreshToken) {
          localStorage.setItem('refreshToken', res.data.refreshToken);
        }
        await refreshUser();
      } catch {
        localStorage.removeItem('refreshToken');
        setToken(null);
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { user: userData, accessToken: token, refreshToken } = res.data;
    setToken(token);
    setAccessToken(token);
    setUser(userData);
    localStorage.setItem('refreshToken', refreshToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      setToken(null);
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem('refreshToken');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Re-export for convenience
export { getToken };
