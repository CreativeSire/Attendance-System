import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { bddApi } from '@/api/bdd';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { BDDCheckIn } from '@/types';
import { getDayOfWeek } from '@/lib/utils';

function CharCount({ value, max }: { value: string; max: number }) {
  const count = value?.length ?? 0;
  return (
    <span className={`text-xs ${count > max * 0.9 ? 'text-warning' : 'text-gray-500'}`}>
      {count}/{max}
    </span>
  );
}

function TextareaField({ label, name, register, watch, required, placeholder, maxLength = 500 }: {
  label: string; name: string; register: (name: string) => object; watch: (name: string) => string;
  required?: boolean; placeholder?: string; maxLength?: number;
}) {
  const value = watch(name) || '';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">{label} {required && <span className="text-danger">*</span>}</Label>
        <CharCount value={value} max={maxLength} />
      </div>
      <textarea
        {...(register(name) as object)}
        placeholder={placeholder}
        rows={3}
        maxLength={maxLength}
        className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent transition-colors"
      />
    </div>
  );
}

function PriorityInputs({ register, prefix, watch }: {
  register: (name: string) => object; prefix: string; watch: (name: string) => string;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-gray-300">Today&apos;s Priorities <span className="text-danger">*</span></Label>
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold shrink-0">{n}</span>
          <input
            {...(register(`${prefix}${n}`) as object)}
            placeholder={`Priority ${n}...`}
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      ))}
    </div>
  );
}

const mondaySchema = z.object({
  weeklyGoal: z.string().min(5, 'Required'),
  lastWeekAccomplishment: z.string().optional(),
  foreseenChallenges: z.string().optional(),
  supportNeeded: z.string().optional(),
  seMeetingFeedback: z.string().optional(),
  mondayPriority1: z.string().min(1, 'Priority 1 required'),
  mondayPriority2: z.string().optional(),
  mondayPriority3: z.string().optional(),
  questionsNotes: z.string().optional(),
});

const dailySchema = z.object({
  progressScore: z.coerce.number().min(0).max(100),
  completedYesterday: z.string().min(5, 'Required'),
  todayPriority1: z.string().min(1, 'Priority 1 required'),
  todayPriority2: z.string().optional(),
  todayPriority3: z.string().optional(),
  blockers: z.string().optional(),
  questionsNotes: z.string().optional(),
});

const saturdaySchema = z.object({
  weeklyAchievement: z.string().min(1, 'Required'),
  keyWins: z.string().min(5, 'Required'),
  aiUsage: z.string().optional(),
  wouldDoDifferently: z.string().optional(),
  nextWeekPriority1: z.string().min(1, 'Priority 1 required'),
  nextWeekPriority2: z.string().optional(),
  nextWeekPriority3: z.string().optional(),
});

type MondayForm = z.infer<typeof mondaySchema>;
type DailyForm = z.infer<typeof dailySchema>;
type SaturdayForm = z.infer<typeof saturdaySchema>;

function ProgressSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color = value >= 70 ? '#2ecc71' : value >= 40 ? '#e67e22' : '#e74c3c';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Progress <span className="text-danger">*</span></Label>
        <span className="font-bold text-lg" style={{ color }}>{value}%</span>
      </div>
      <div className="relative h-3 bg-surface-2 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent cursor-pointer"
      />
    </div>
  );
}

export default function BDDForm() {
  const navigate = useNavigate();
  const [todayBDD, setTodayBDD] = useState<BDDCheckIn | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const dayOfWeek = getDayOfWeek();
  const isMonday = dayOfWeek === 'MONDAY';
  const isSaturday = dayOfWeek === 'SATURDAY';
  const isDaily = !isMonday && !isSaturday;

  useEffect(() => {
    bddApi.getTodayBDD()
      .then((res) => setTodayBDD((res as { data: BDDCheckIn | null }).data))
      .catch(() => setTodayBDD(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (todayBDD) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="bg-success/10 border border-success/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={24} className="text-success" />
            <div>
              <h2 className="text-white font-semibold text-lg">Already submitted today!</h2>
              <p className="text-gray-400 text-sm">Submitted at {format(new Date(todayBDD.createdAt), 'HH:mm')}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            {todayBDD.weeklyGoal && (
              <div><span className="text-gray-500">Weekly Goal: </span><span className="text-gray-300">{todayBDD.weeklyGoal}</span></div>
            )}
            {todayBDD.completedYesterday && (
              <div><span className="text-gray-500">Completed Yesterday: </span><span className="text-gray-300">{todayBDD.completedYesterday}</span></div>
            )}
            {(todayBDD.todayPriority1 || todayBDD.mondayPriority1) && (
              <div>
                <span className="text-gray-500">Priorities: </span>
                <ol className="mt-1 space-y-1 ml-4 list-decimal text-gray-300">
                  {[todayBDD.todayPriority1 ?? todayBDD.mondayPriority1, todayBDD.todayPriority2 ?? todayBDD.mondayPriority2, todayBDD.todayPriority3 ?? todayBDD.mondayPriority3]
                    .filter(Boolean).map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              </div>
            )}
          </div>
          <Button onClick={() => navigate('/dashboard')} className="mt-5 gradient-accent text-white">
            Go to Dashboard <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Cannot skip banner */}
      <div className="border-l-4 border-warning bg-warning/10 rounded-r-xl px-5 py-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-warning mt-0.5 shrink-0" />
        <div>
          <p className="text-white font-semibold">Complete your daily check-in to continue</p>
          <p className="text-gray-400 text-sm mt-0.5">This must be completed before you proceed with your day</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            {isMonday ? 'Weekly Brief' : isSaturday ? 'Weekly Wrap' : 'Daily Standup'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {isMonday && <MondayForm onSubmit={async (data) => {
          await bddApi.submit({
            weeklyGoal: data.weeklyGoal,
            mondayPriority1: data.mondayPriority1,
            mondayPriority2: data.mondayPriority2,
            mondayPriority3: data.mondayPriority3,
            resourcesNeeded: data.supportNeeded,
            potentialBlockers: data.foreseenChallenges,
          });
          toast.success('Daily pulse submitted!');
          navigate('/dashboard');
        }} />}

        {isDaily && <DailyFormComponent onSubmit={async (data) => {
          await bddApi.submit({
            progressScore: data.progressScore,
            completedYesterday: data.completedYesterday,
            todayPriority1: data.todayPriority1,
            todayPriority2: data.todayPriority2,
            todayPriority3: data.todayPriority3,
            blockers: data.blockers,
          });
          toast.success('Daily pulse submitted!');
          navigate('/dashboard');
        }} />}

        {isSaturday && <SaturdayFormComponent onSubmit={async (data) => {
          await bddApi.submit({
            weeklyAchievement: data.weeklyAchievement,
            keyWins: data.keyWins,
            aiUsage: data.aiUsage,
            nextWeekPriorities: [data.nextWeekPriority1, data.nextWeekPriority2, data.nextWeekPriority3].filter(Boolean).join('\n'),
          });
          toast.success('Weekly wrap submitted!');
          navigate('/dashboard');
        }} />}
      </div>
    </div>
  );
}

function MondayForm({ onSubmit }: { onSubmit: (data: MondayForm) => Promise<void> }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<MondayForm>({
    resolver: zodResolver(mondaySchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <TextareaField label="Last Week's Accomplishments" name="lastWeekAccomplishment" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="What did you accomplish last week?" />
      <TextareaField label="Weekly Goal" name="weeklyGoal" register={register as (name: string) => object} watch={watch as (name: string) => string} required placeholder="What is your main goal this week?" />
      {errors.weeklyGoal && <p className="text-danger text-xs">{errors.weeklyGoal.message}</p>}
      <TextareaField label="Foreseen Challenges" name="foreseenChallenges" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="Any blockers or challenges you anticipate?" />
      <TextareaField label="Support Needed" name="supportNeeded" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="What resources or help do you need?" />
      <TextareaField label="SE Meeting Feedback" name="seMeetingFeedback" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="Feedback from your last sync meeting..." />
      <PriorityInputs register={register as (name: string) => object} prefix="mondayPriority" watch={watch as (name: string) => string} />
      {errors.mondayPriority1 && <p className="text-danger text-xs">{errors.mondayPriority1.message}</p>}
      <TextareaField label="Questions / Notes" name="questionsNotes" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="Any questions or notes for the team?" />
      <Button type="submit" size="lg" className="w-full gradient-accent text-white" isLoading={isSubmitting}>
        Submit Daily Pulse
      </Button>
    </form>
  );
}

function DailyFormComponent({ onSubmit }: { onSubmit: (data: DailyForm) => Promise<void> }) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<DailyForm>({
    resolver: zodResolver(dailySchema),
    defaultValues: { progressScore: 50 },
  });

  const progressScore = watch('progressScore') ?? 50;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <ProgressSlider value={Number(progressScore)} onChange={(v) => setValue('progressScore', v)} />
      {errors.progressScore && <p className="text-danger text-xs">{errors.progressScore.message}</p>}
      <TextareaField label="Completed Yesterday" name="completedYesterday" register={register as (name: string) => object} watch={watch as (name: string) => string} required placeholder="What did you complete yesterday?" />
      {errors.completedYesterday && <p className="text-danger text-xs">{errors.completedYesterday.message}</p>}
      <PriorityInputs register={register as (name: string) => object} prefix="todayPriority" watch={watch as (name: string) => string} />
      {errors.todayPriority1 && <p className="text-danger text-xs">{errors.todayPriority1.message}</p>}
      <TextareaField label="Blockers" name="blockers" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="Any blockers or impediments?" />
      <TextareaField label="Questions / Notes" name="questionsNotes" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="Any questions or notes?" />
      <Button type="submit" size="lg" className="w-full gradient-accent text-white" isLoading={isSubmitting}>
        Submit Daily Pulse
      </Button>
    </form>
  );
}

function SaturdayFormComponent({ onSubmit }: { onSubmit: (data: SaturdayForm) => Promise<void> }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SaturdayForm>({
    resolver: zodResolver(saturdaySchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-gray-300">Goal Achievement <span className="text-danger">*</span></Label>
        <select {...register('weeklyAchievement')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
          <option value="">Select...</option>
          <option value="FULLY_ACHIEVED">Fully Achieved</option>
          <option value="PARTIALLY_ACHIEVED">Partially Achieved</option>
          <option value="NOT_ACHIEVED">Not Achieved</option>
        </select>
        {errors.weeklyAchievement && <p className="text-danger text-xs">{errors.weeklyAchievement.message}</p>}
      </div>
      <TextareaField label="Key Wins This Week" name="keyWins" register={register as (name: string) => object} watch={watch as (name: string) => string} required placeholder="What were your biggest wins this week?" />
      {errors.keyWins && <p className="text-danger text-xs">{errors.keyWins.message}</p>}
      <TextareaField label="AI Usage This Week" name="aiUsage" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="How did you use AI tools this week?" />
      <TextareaField label="What Would You Do Differently?" name="wouldDoDifferently" register={register as (name: string) => object} watch={watch as (name: string) => string} placeholder="Reflection on what could be improved..." />
      <div className="space-y-3">
        <Label className="text-gray-300">Next Week&apos;s Priorities <span className="text-danger">*</span></Label>
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold shrink-0">{n}</span>
            <input
              {...register(`nextWeekPriority${n}` as keyof SaturdayForm)}
              placeholder={`Priority ${n}...`}
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        ))}
        {errors.nextWeekPriority1 && <p className="text-danger text-xs">{errors.nextWeekPriority1.message}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full gradient-accent text-white" isLoading={isSubmitting}>
        Submit Weekly Wrap
      </Button>
    </form>
  );
}
