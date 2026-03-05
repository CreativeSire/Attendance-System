import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertCircle, MapPin, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid email or password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (email: string, pwd: string) => {
    setEmail(email);
    setPassword(pwd);
  };

  const features = [
    { icon: MapPin, text: 'GPS Location Tracking' },
    { icon: Clock, text: 'Real-time Attendance' },
    { icon: Shield, text: 'Secure QR Check-in' },
    { icon: Users, text: 'Team Management' },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col lg:flex-row">
      {/* Left Side - Branding (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#6C63FF] to-[#4c45b5] flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-8">
            <Clock className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">DALA</h1>
          <p className="text-xl text-white/80 mb-8">Smart Attendance System</p>
          
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/70">
                <feature.icon className="w-5 h-5" />
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 lg:p-8">
        {/* Mobile Logo */}
        <div className="lg:hidden text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#8b5cf6] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#6C63FF]/30">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e0e0f0]">DALA Attendance</h1>
          <p className="text-[#888] text-sm mt-1">Workforce Management</p>
        </div>

        <Card className="w-full max-w-md bg-[#1e1e35] border-[#2a2a4a] shadow-2xl">
          <CardContent className="p-6 lg:p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-[#e0e0f0]">Welcome Back</h2>
              <p className="text-sm text-[#888] mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#e0e0f0] text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@dala.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0] placeholder:text-[#666] rounded-xl focus:ring-[#6C63FF] focus:border-[#6C63FF]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#e0e0f0] text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0] placeholder:text-[#666] rounded-xl focus:ring-[#6C63FF] focus:border-[#6C63FF]"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8b5cf6] hover:from-[#5a52d5] hover:to-[#7c3aed] shadow-lg shadow-[#6C63FF]/20 active:scale-[0.98] transition-all"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Quick Login */}
            <div className="mt-6 pt-6 border-t border-[#2a2a4a]">
              <p className="text-xs text-[#666] text-center mb-4">Quick Demo Login</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Amara', email: 'amara@dala.ng', role: 'Admin', color: 'from-purple-500 to-purple-600' },
                  { name: 'Chidi', email: 'chidi@dala.ng', role: 'Manager', color: 'from-blue-500 to-blue-600' },
                  { name: 'Fatima', email: 'fatima@dala.ng', role: 'Staff', color: 'from-emerald-500 to-emerald-600' },
                ].map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => quickLogin(user.email, 'password')}
                    className={cn(
                      "p-3 rounded-xl bg-gradient-to-br text-white text-center transition-all active:scale-95",
                      user.color
                    )}
                  >
                    <p className="font-semibold text-sm">{user.name}</p>
                    <p className="text-[10px] opacity-80">{user.role}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-xs text-[#666] text-center">
          DALA Technologies © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
