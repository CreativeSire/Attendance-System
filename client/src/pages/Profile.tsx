import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Camera, Lock, ShieldCheck, Sparkles, User, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { employeesApi } from '@/api/employees';
import { authApi } from '@/api/auth';
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
import { normalizeFaceEnrollment } from '@/api/normalizers';
import type { FaceEnrollment } from '@/types';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'Use 4 to 6 digits'),
  confirmPin: z.string().regex(/^\d{4,6}$/, 'Use 4 to 6 digits'),
}).refine((data) => data.pin === data.confirmPin, {
  message: 'PINs do not match',
  path: ['confirmPin'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type PinForm = z.infer<typeof pinSchema>;

const enrollmentPrompts = [
  { kind: 'frontal', label: 'Front-facing', instruction: 'Look straight at the camera, keep your head inside the frame, and hold still.' },
  { kind: 'slight_left', label: 'Slight left turn', instruction: 'Turn your face slightly left while keeping both eyes visible.' },
  { kind: 'slight_right', label: 'Slight right turn', instruction: 'Turn your face slightly right while keeping both eyes visible.' },
  { kind: 'neutral', label: 'Neutral expression', instruction: 'Relax your face naturally, keep your head level, and capture a clean neutral image.' },
  { kind: 'glasses_optional', label: 'With usual glasses (optional)', instruction: 'If you regularly wear glasses at work, keep them on for this capture.' },
];

function ProfileSection({ userId, currentName, currentPhone, onUpdated }: {
  userId: string;
  currentName: string;
  currentPhone?: string;
  onUpdated: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    defaultValues: { name: currentName, phone: currentPhone ?? '' },
    resolver: zodResolver(profileSchema),
  });

  const onSubmit = async (data: ProfileForm) => {
    try {
      await employeesApi.update(userId, data);
      toast.success('Profile updated.');
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="flex items-center gap-2 text-white font-semibold">
        <User size={16} className="text-accent" />
        Basic profile
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-gray-300">Full name</Label>
          <Input {...register('name')} className="bg-surface-2 border-border text-white" />
          {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">Phone</Label>
          <Input {...register('phone')} className="bg-surface-2 border-border text-white placeholder:text-gray-500" placeholder="+234 800 000 0000" />
        </div>
      </div>
      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Save profile
      </Button>
    </form>
  );
}

function SecuritySection() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordForm) => {
    try {
      await authApi.updateProfile({ password: data.newPassword });
      toast.success('Password updated.');
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="flex items-center gap-2 text-white font-semibold">
        <Lock size={16} className="text-accent" />
        Password
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-gray-300">Current password</Label>
          <Input {...register('currentPassword')} type="password" className="bg-surface-2 border-border text-white" />
          {errors.currentPassword ? <p className="text-xs text-danger">{errors.currentPassword.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">New password</Label>
          <Input {...register('newPassword')} type="password" className="bg-surface-2 border-border text-white" />
          {errors.newPassword ? <p className="text-xs text-danger">{errors.newPassword.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">Confirm new password</Label>
          <Input {...register('confirmPassword')} type="password" className="bg-surface-2 border-border text-white" />
          {errors.confirmPassword ? <p className="text-xs text-danger">{errors.confirmPassword.message}</p> : null}
        </div>
      </div>
      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}

function PinSection({ hasPin, onUpdated }: { hasPin: boolean; onUpdated: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PinForm>({
    resolver: zodResolver(pinSchema),
  });

  const onSubmit = async ({ pin }: PinForm) => {
    try {
      await authApi.setupPin(pin);
      toast.success(hasPin ? 'PIN updated.' : 'PIN created.');
      reset();
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save PIN.');
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <KeyRound size={18} className="text-accent" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">Employee PIN</h3>
            <Badge variant={hasPin ? 'success' : 'warning'}>{hasPin ? 'Configured' : 'Required'}</Badge>
          </div>
          <p className="text-sm text-gray-400">
            This is your first verification factor before face, liveness, and location kick in.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-gray-300">{hasPin ? 'Set a new PIN' : 'Create your PIN'}</Label>
          <Input {...register('pin')} inputMode="numeric" type="password" maxLength={6} className="bg-surface-2 border-border text-white" />
          {errors.pin ? <p className="text-xs text-danger">{errors.pin.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300">Confirm PIN</Label>
          <Input {...register('confirmPin')} inputMode="numeric" type="password" maxLength={6} className="bg-surface-2 border-border text-white" />
          {errors.confirmPin ? <p className="text-xs text-danger">{errors.confirmPin.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {hasPin ? 'Update PIN' : 'Save PIN'}
        </Button>
      </form>
    </div>
  );
}

function FaceEnrollmentSection({
  enrollment,
  onUpdated,
}: {
  enrollment: FaceEnrollment | null;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<Array<{ kind: string; imageRef: string; qualityScore?: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [appearance, setAppearance] = useState({
    usuallyWearsGlasses: false,
    facialHairCommon: false,
    headwearCommon: false,
  });

  const currentPrompt = enrollmentPrompts[stepIndex];

  const openEnrollment = () => {
    setCapturedImages([]);
    setStepIndex(0);
    setOpen(true);
  };

  const handleCapture = (photo: string) => {
    const qualityScore = currentPrompt.kind === 'glasses_optional' && !appearance.usuallyWearsGlasses ? 0.75 : 0.88;
    setCapturedImages((current) => {
      const next = current.filter((item) => item.kind !== currentPrompt.kind);
      return [...next, { kind: currentPrompt.kind, imageRef: photo, qualityScore }];
    });
  };

  const moveStep = (nextIndex: number) => {
    setStepIndex(Math.max(0, Math.min(enrollmentPrompts.length - 1, nextIndex)));
  };

  const saveEnrollment = async () => {
    const baseImages = capturedImages.filter((item) => item.kind !== 'glasses_optional');
    if (baseImages.length < 4) {
      toast.error('Capture the first four guided enrollment images before saving.');
      return;
    }

    const images = appearance.usuallyWearsGlasses
      ? capturedImages
      : capturedImages.filter((item) => item.kind !== 'glasses_optional');

    setSaving(true);
    try {
      await authApi.saveFaceEnrollment({
        images,
        appearanceMetadata: appearance,
      });
      toast.success('Face enrollment saved.');
      setOpen(false);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save face enrollment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Camera size={18} className="text-accent" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">Face enrollment</h3>
              <Badge variant={enrollment ? 'success' : 'warning'}>
                {enrollment ? `Version ${enrollment.version}` : 'Required'}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">
              Capture multiple guided images so verification stays resilient even with glasses, hair changes, or difficult lighting.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={openEnrollment}>
          <Camera size={14} />
          {enrollment ? 'Re-enroll' : 'Enroll now'}
        </Button>
      </div>

      {enrollment ? (
        <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-gray-200">
          Active enrollment uses {enrollment.images.length} reference image{enrollment.images.length === 1 ? '' : 's'} with an average quality score of {(enrollment.qualityScore * 100).toFixed(0)}%.
        </div>
      ) : (
        <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-gray-200">
          Face enrollment is still missing, so the new PIN-led clock-in flow cannot fully complete until you set it up.
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-border text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guided face enrollment</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-2/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    Capture {stepIndex + 1} of {enrollmentPrompts.length}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">{currentPrompt.label}</p>
                  <p className="mt-1 text-sm text-gray-400">{currentPrompt.instruction}</p>
                </div>

                <FaceCapture
                  instruction={currentPrompt.instruction}
                  onCapture={(photo) => handleCapture(photo)}
                />

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => moveStep(stepIndex - 1)} disabled={stepIndex === 0}>
                    Previous
                  </Button>
                  <Button onClick={() => moveStep(stepIndex + 1)} disabled={stepIndex === enrollmentPrompts.length - 1}>
                    Next capture
                  </Button>
                  <Button className="ml-auto" isLoading={saving} onClick={saveEnrollment}>
                    Save enrollment
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                  <p className="text-sm font-medium text-white">Appearance profile</p>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={appearance.usuallyWearsGlasses} onChange={(e) => setAppearance((current) => ({ ...current, usuallyWearsGlasses: e.target.checked }))} />
                    Usually wears glasses
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={appearance.facialHairCommon} onChange={(e) => setAppearance((current) => ({ ...current, facialHairCommon: e.target.checked }))} />
                    Facial hair is common
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={appearance.headwearCommon} onChange={(e) => setAppearance((current) => ({ ...current, headwearCommon: e.target.checked }))} />
                    Headwear is common
                  </label>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                  <p className="text-sm font-medium text-white">Captured images</p>
                  {enrollmentPrompts.map((prompt) => {
                    const existing = capturedImages.find((item) => item.kind === prompt.kind);
                    return (
                      <div key={prompt.kind} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                        <span className="text-gray-300">{prompt.label}</span>
                        <span className={existing ? 'text-success' : 'text-gray-500'}>
                          {existing ? 'Ready' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsSection({ userId }: { userId: string }) {
  const [stats, setStats] = useState<{ attendanceRate: number; lateDays: number; presentDays: number; totalWorkHours: number } | null>(null);
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

        if (statsRes.status === 'fulfilled') setStats((statsRes.value as { data: typeof stats }).data);
        if (balRes.status === 'fulfilled') setLeaveBalance((balRes.value as { data: typeof leaveBalance }).data);
        if (perfRes.status === 'fulfilled') setPerfScore(((perfRes.value as { data: { overallScore: number } }).data)?.overallScore ?? null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-surface border border-border rounded-xl p-4 animate-pulse">
            <div className="mb-2 h-8 rounded bg-surface-2" />
            <div className="h-3 w-2/3 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    );
  }

  const totalLeave = (leaveBalance?.annual ?? 0) + (leaveBalance?.sick ?? 0) + (leaveBalance?.casual ?? 0);
  const cards = [
    { label: 'Attendance', value: `${(stats?.attendanceRate ?? 0).toFixed(0)}%`, color: 'text-success' },
    { label: 'Late Days', value: stats?.lateDays ?? 0, color: 'text-warning' },
    { label: 'Leave Balance', value: `${totalLeave}d`, color: 'text-blue-400' },
    { label: 'Perf. Score', value: perfScore !== null ? perfScore.toFixed(0) : '--', color: 'text-accent' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-surface border border-border rounded-xl p-4">
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          <div className="mt-1 text-xs text-gray-500">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, refreshUser } = useAuth() as { user: import('@/types').User | null; refreshUser?: () => Promise<void> };
  const [refreshKey, setRefreshKey] = useState(0);
  const [faceEnrollment, setFaceEnrollment] = useState<FaceEnrollment | null>(null);

  const loadFaceEnrollment = useCallback(async () => {
    try {
      const res = await authApi.getFaceEnrollment();
      const payload = (res as { data: unknown }).data;
      if (payload && typeof payload === 'object') {
        setFaceEnrollment(normalizeFaceEnrollment(payload as Record<string, unknown>));
      } else {
        setFaceEnrollment(null);
      }
    } catch {
      setFaceEnrollment(null);
    }
  }, []);

  useEffect(() => {
    loadFaceEnrollment();
  }, [loadFaceEnrollment, refreshKey]);

  const handleUpdated = useCallback(async () => {
    if (refreshUser) await refreshUser();
    setRefreshKey((value) => value + 1);
  }, [refreshUser]);

  const hasFace = useMemo(() => Boolean(faceEnrollment?.images?.length || user?.hasFaceEnrollment), [faceEnrollment, user?.hasFaceEnrollment]);

  if (!user) return <Spinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="mt-1 text-sm text-gray-400">Prepare your identity profile for the new PIN, face, liveness, and location attendance flow.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl gradient-accent text-3xl font-bold text-white">
            {getInitials(user.name)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                <p className="mt-1 text-gray-400">{user.position}</p>
                <p className="text-sm text-gray-500">{user.department}</p>
              </div>
              <div className="space-y-1 text-right">
                <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'manager' ? 'warning' : 'secondary'}>
                  {user.role}
                </Badge>
                <p className="text-xs text-gray-500">ID: {(user.employeeId || user.id).slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-500">Joined: {format(parseISO(user.createdAt), 'MMM d, yyyy')}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border p-4 ${user.hasPin ? 'border-success/20 bg-success/10' : 'border-warning/20 bg-warning/10'}`}>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <KeyRound size={14} />
                  PIN
                </div>
                <p className="mt-1 text-xs text-gray-300">{user.hasPin ? 'Ready for secure attendance' : 'Still needs setup'}</p>
              </div>
              <div className={`rounded-xl border p-4 ${hasFace ? 'border-success/20 bg-success/10' : 'border-warning/20 bg-warning/10'}`}>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Camera size={14} />
                  Face enrollment
                </div>
                <p className="mt-1 text-xs text-gray-300">{hasFace ? 'Multi-image profile ready' : 'Still needs setup'}</p>
              </div>
              <div className="rounded-xl border border-accent/20 bg-accent/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Sparkles size={14} />
                  Liveness ready
                </div>
                <p className="mt-1 text-xs text-gray-300">Random challenge pool will be generated at clock-in time.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatsSection key={refreshKey} userId={user.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-xl p-6">
          <ProfileSection userId={user.id} currentName={user.name} currentPhone={user.phone} onUpdated={handleUpdated} />
          <div className="mt-5 space-y-3 border-t border-border pt-5">
            {[
              { label: 'Email', value: user.email },
              { label: 'Employee ID', value: user.employeeId || user.id.slice(0, 8).toUpperCase() },
              { label: 'Role', value: user.role },
            ].map((field) => (
              <div key={field.label} className="space-y-1">
                <Label className="text-xs text-gray-500">{field.label}</Label>
                <div className="rounded-lg border border-border/50 bg-surface-2/50 px-3 py-2.5 text-sm text-gray-300">{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <SecuritySection />
        </div>
      </div>

      <PinSection hasPin={Boolean(user.hasPin)} onUpdated={handleUpdated} />

      <FaceEnrollmentSection enrollment={faceEnrollment} onUpdated={handleUpdated} />

      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <ShieldCheck size={18} className="text-accent" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-semibold">What the system will check at clock-in</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Your employee PIN proves knowledge before biometrics start.</li>
              <li>• A fresh face capture is compared against your enrollment set, not just one old image.</li>
              <li>• One or two randomized liveness challenges are issued based on risk.</li>
              <li>• Live location is classified against office zones, staff quarters, and restricted zones.</li>
              <li>• Suspicious attempts can still be logged and sent to the manager review queue automatically.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
