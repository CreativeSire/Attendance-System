import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Camera, Lock, User, Shield, TrendingUp, CalendarDays, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { employeesApi } from '@/api/employees';
import { authApi } from '@/api/auth';
import { attendanceApi } from '@/api/attendance';
import { performanceApi } from '@/api/performance';
import { leavesApi } from '@/api/leaves';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FaceCapture from '@/components/FaceCapture';
import { getInitials } from '@/lib/utils';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// -------- Profile Form --------
const profileSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function ProfileSection({ userId, currentName, currentPhone, onUpdated }: {
  userId: string; currentName: string; currentPhone?: string; onUpdated: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    defaultValues: { name: currentName, phone: currentPhone ?? '' },
  });

  const onSubmit = async (data: ProfileForm) => {
    try {
      await employeesApi.update(userId, data);
      toast.success('Profile updated!');
      onUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <User size={16} className="text-accent" /> Edit Profile
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-gray-300">Full Name</Label>
          <Input {...register('name')} className="bg-surface-2 border-border text-white" />
          {errors.name && <p className="text-danger text-xs">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">Phone</Label>
          <Input {...register('phone')} placeholder="+234 800 000 0000" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
        </div>
      </div>
      <Button type="submit" className="gradient-accent text-white w-full" isLoading={isSubmitting}>
        Save Changes
      </Button>
    </form>
  );
}

// -------- Password Form --------
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

function SecuritySection() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordForm) => {
    try {
      await authApi.updateProfile({ password: data.newPassword });
      toast.success('Password updated!');
      reset();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <Lock size={16} className="text-accent" /> Change Password
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-gray-300">Current Password</Label>
          <Input {...register('currentPassword')} type="password" placeholder="••••••••" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
          {errors.currentPassword && <p className="text-danger text-xs">{errors.currentPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">New Password</Label>
          <Input {...register('newPassword')} type="password" placeholder="Min 8 characters" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
          {errors.newPassword && <p className="text-danger text-xs">{errors.newPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">Confirm New Password</Label>
          <Input {...register('confirmPassword')} type="password" placeholder="••••••••" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
          {errors.confirmPassword && <p className="text-danger text-xs">{errors.confirmPassword.message}</p>}
        </div>
      </div>
      <Button type="submit" className="gradient-accent text-white w-full" isLoading={isSubmitting}>
        Update Password
      </Button>
    </form>
  );
}

// -------- Face Registration --------
function FaceRegistrationSection({ userId, hasFaceRegistered, onUpdated }: {
  userId: string; hasFaceRegistered: boolean; onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCapture = async (photo: string) => {
    setSaving(true);
    try {
      await employeesApi.update(userId, { masterPhoto: photo } as Parameters<typeof employeesApi.update>[1]);
      toast.success('Face registered successfully!');
      setOpen(false);
      onUpdated();
    } catch {
      // Try alternative endpoint
      try {
        await authApi.uploadMasterPhoto(photo);
        toast.success('Face registered successfully!');
        setOpen(false);
        onUpdated();
      } catch (err2: unknown) {
        toast.error(err2 instanceof Error ? err2.message : 'Failed to register face');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
            <Camera size={18} className="text-accent" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Face Recognition</h3>
            <p className="text-gray-400 text-sm mt-0.5">
              {hasFaceRegistered
                ? 'Your face is registered for biometric clock-in'
                : 'Register your face to enable biometric clock-in'}
            </p>
            <div className="mt-2">
              {hasFaceRegistered
                ? <span className="text-success text-xs bg-success/10 px-2.5 py-1 rounded-full font-medium">Registered</span>
                : <span className="text-warning text-xs bg-warning/10 px-2.5 py-1 rounded-full font-medium">Not Registered</span>}
            </div>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} variant="outline" size="sm">
          <Camera size={14} /> {hasFaceRegistered ? 'Update' : 'Register'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-border text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>{hasFaceRegistered ? 'Update Face' : 'Register Face'}</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <FaceCapture
              instruction="Center your face clearly in frame and capture"
              onCapture={(photo) => { if (!saving) handleCapture(photo); }}
            />
            {saving && (
              <div className="flex items-center justify-center gap-2 mt-3 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------- Stats Section --------
interface MyStats {
  attendanceRate: number;
  lateDays: number;
  presentDays: number;
  totalWorkHours: number;
}

function StatsSection({ userId }: { userId: string }) {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<{ annual: number; sick: number; casual: number } | null>(null);
  const [perfScore, setPerfScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, balRes, perfRes] = await Promise.allSettled([
          employeesApi.getEmployeeStats(userId),
          leavesApi.getBalance(),
          performanceApi.getMyPerformanceScore(),
        ]);

        if (statsRes.status === 'fulfilled') {
          setStats((statsRes.value as { data: MyStats }).data);
        }
        if (balRes.status === 'fulfilled') {
          setLeaveBalance((balRes.value as { data: { annual: number; sick: number; casual: number } }).data);
        }
        if (perfRes.status === 'fulfilled') {
          setPerfScore(((perfRes.value as { data: { overallScore: number } }).data)?.overallScore ?? null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse">
          <div className="h-8 bg-surface-2 rounded mb-2" />
          <div className="h-3 bg-surface-2 rounded w-2/3" />
        </div>
      ))}
    </div>
  );

  const totalLeave = (leaveBalance?.annual ?? 0) + (leaveBalance?.sick ?? 0) + (leaveBalance?.casual ?? 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: 'Attendance (Month)', value: `${(stats?.attendanceRate ?? 0).toFixed(0)}%`, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
        { label: 'Late Days', value: stats?.lateDays ?? 0, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
        { label: 'Leave Balance', value: `${totalLeave}d`, icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Perf. Score', value: perfScore !== null ? perfScore.toFixed(0) : '--', icon: Shield, color: 'text-accent', bg: 'bg-accent/10' },
      ].map((s) => (
        <div key={s.label} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg} shrink-0`}>
            <s.icon size={18} className={s.color} />
          </div>
          <div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-gray-500 text-xs">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// -------- Main --------
export default function Profile() {
  const { user, refreshUser } = useAuth() as { user: import('@/types').User | null; refreshUser?: () => void };
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUpdated = useCallback(() => {
    if (refreshUser) refreshUser();
    setRefreshKey((k) => k + 1);
  }, [refreshUser]);

  if (!user) return <Spinner />;

  const hasFace = !!user.masterPhotoUrl;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account settings</p>
      </div>

      {/* Hero */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start gap-5">
          <div className="w-24 h-24 gradient-accent rounded-2xl flex items-center justify-center text-white text-3xl font-bold shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-white text-2xl font-bold">{user.name}</h2>
                <p className="text-gray-400 mt-0.5">{user.position}</p>
                <p className="text-gray-500 text-sm mt-0.5">{user.department}</p>
              </div>
              <div className="text-right space-y-1">
                <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'manager' ? 'warning' : 'secondary'}>
                  {user.role}
                </Badge>
                <p className="text-gray-500 text-xs">ID: {user.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-gray-500 text-xs">Joined: {format(parseISO(user.createdAt), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsSection key={refreshKey} userId={user.id} />

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6">
          <ProfileSection
            userId={user.id}
            currentName={user.name}
            currentPhone={user.phone}
            onUpdated={handleUpdated}
          />

          {/* Readonly fields */}
          <div className="mt-5 pt-5 border-t border-border space-y-3">
            {[
              { label: 'Email', value: user.email },
              { label: 'Employee ID', value: user.id.slice(0, 8).toUpperCase() },
              { label: 'Role', value: user.role },
            ].map((f) => (
              <div key={f.label} className="space-y-1">
                <Label className="text-gray-500 text-xs">{f.label}</Label>
                <div className="bg-surface-2/50 border border-border/50 rounded-lg px-3 py-2.5 text-gray-400 text-sm">{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <SecuritySection />
        </div>
      </div>

      {/* Face registration */}
      <FaceRegistrationSection userId={user.id} hasFaceRegistered={hasFace} onUpdated={handleUpdated} />
    </div>
  );
}
