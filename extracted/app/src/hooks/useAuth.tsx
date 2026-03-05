import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';

const API_BASE_URL = 'http://localhost:3001/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  employees: User[];
  updateMasterPhoto: (userId: string, photo: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  }, []);

  const updateMasterPhoto = useCallback(async (userId: string, photo: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees/${userId}/photo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo })
      });
      const updatedUser = await res.json();
      
      setEmployees(prev => prev.map(e => e.id === userId ? updatedUser : e));
      if (user && user.id === userId) {
        setUser(updatedUser);
        localStorage.setItem('dala_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Failed to update photo', err);
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (res.ok) {
        const foundUser = await res.json();
        setUser(foundUser);
        localStorage.setItem('dala_user', JSON.stringify(foundUser));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error', err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('dala_user');
  }, []);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  React.useEffect(() => {
    const stored = localStorage.getItem('dala_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    fetchEmployees();
    setLoading(false);
  }, [fetchEmployees]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      hasRole,
      employees,
      updateMasterPhoto,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
