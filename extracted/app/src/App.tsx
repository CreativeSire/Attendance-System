import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Login } from '@/sections/Login';
import { Dashboard } from '@/sections/Dashboard';
import { Toaster } from 'sonner';

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e1e35',
            color: '#e0e0f0',
            border: '1px solid #2a2a4a',
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;
