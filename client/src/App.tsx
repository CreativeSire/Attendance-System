import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ClockIn from '@/pages/ClockIn';
import BDDForm from '@/pages/BDDForm';
import EntryScreen from '@/pages/EntryScreen';
import Attendance from '@/pages/Attendance';
import Leaves from '@/pages/Leaves';
import Expenses from '@/pages/Expenses';
import Payroll from '@/pages/Payroll';
import Performance from '@/pages/Performance';
import Team from '@/pages/Team';
import Admin from '@/pages/Admin';
import Profile from '@/pages/Profile';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/entry/:entryPointId" element={<EntryScreen />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clock-in" element={<ClockIn />} />
        <Route path="/bdd" element={<BDDForm />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/team" element={<ProtectedRoute roles={['admin','manager']}><Team /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          <Toaster position="top-right" theme="dark" richColors />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
