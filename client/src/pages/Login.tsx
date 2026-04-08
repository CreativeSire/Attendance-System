import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Zap, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setApiError(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden px-14 py-12"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #252540 100%)' }}>
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(rgba(108,99,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Dala</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-bold text-white leading-tight">
            Intelligent<br />
            <span className="text-gradient">Workforce</span><br />
            Management
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
            Track attendance, manage your team, and grow together with real-time insights and AI-powered analytics.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { label: 'Employees', value: '500+' },
              { label: 'Accuracy', value: '99.8%' },
              { label: 'Uptime', value: '99.9%' },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface/50 rounded-xl p-4 border border-border">
                <div className="text-xl font-bold text-accent">{stat.value}</div>
                <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} Dala Technologies. All rights reserved.
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:max-w-md xl:max-w-lg bg-surface">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Dala</span>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-white">Welcome back</h2>
            <p className="text-gray-400 mt-2">Sign in to your workspace account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {apiError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
                {apiError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email address</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="pl-10 bg-surface-2 border-border text-white placeholder:text-gray-500"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-danger text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-surface-2 border-border text-white placeholder:text-gray-500"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-danger text-xs">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full gradient-accent text-white font-semibold"
              isLoading={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Demo Credentials</p>
            <div className="space-y-2">
              {[
                { email: 'admin@dala.com', password: 'admin123', label: 'Admin', color: 'text-accent' },
                { email: 'sarah@dala.com', password: 'password123', label: 'Manager', color: 'text-success' },
                { email: 'amaka@dala.com', password: 'password123', label: 'Employee', color: 'text-warning' },
              ].map((cred) => (
                <button
                  key={cred.email}
                  type="button"
                  onClick={() => fillDemo(cred.email, cred.password)}
                  className="w-full flex items-center justify-between text-xs rounded-lg p-2 bg-background/50 hover:bg-background transition-colors group"
                >
                  <div className="text-left">
                    <span className={`font-semibold ${cred.color}`}>{cred.label}</span>
                    <span className="text-gray-500 ml-2">{cred.email}</span>
                  </div>
                  <span className="text-gray-600 group-hover:text-accent text-xs">Use &rarr;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
