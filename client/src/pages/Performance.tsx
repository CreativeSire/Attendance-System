import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { Flame, Plus, Target, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { performanceApi } from '@/api/performance';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { PerformanceGoal } from '@/types';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function CircularGauge({ value, size = 120 }: { value: number; size?: number }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 80 ? '#2ecc71' : value >= 60 ? '#e67e22' : '#e74c3c';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2a3e" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-gray-500 text-xs">/ 100</span>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-2 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className={`font-bold text-sm ${color}`}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all`} style={{ width: `${value}%`, backgroundColor: color.replace('text-', '') === 'text-success' ? '#2ecc71' : color.includes('warning') ? '#e67e22' : '#6C63FF' }} />
      </div>
    </div>
  );
}

const goalSchema = z.object({
  title: z.string().min(2, 'Title required'),
  description: z.string().optional(),
  targetDate: z.string().min(1, 'Date required'),
  quarter: z.string().min(1, 'Quarter required'),
  year: z.coerce.number().int(),
  kr1Title: z.string().min(1, 'Required'),
  kr1Target: z.coerce.number().positive(),
  kr2Title: z.string().optional(),
  kr2Target: z.coerce.number().optional(),
  kr3Title: z.string().optional(),
  kr3Target: z.coerce.number().optional(),
});

type GoalForm = z.infer<typeof goalSchema>;

function GoalDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: { year: new Date().getFullYear(), quarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}` },
  });

  const onSubmit = async (data: GoalForm) => {
    const keyResults = [
      { title: data.kr1Title, target: data.kr1Target },
      ...(data.kr2Title ? [{ title: data.kr2Title, target: data.kr2Target ?? 100 }] : []),
      ...(data.kr3Title ? [{ title: data.kr3Title, target: data.kr3Target ?? 100 }] : []),
    ];
    try {
      await performanceApi.createGoal({
        title: data.title,
        description: data.description,
        targetDate: data.targetDate,
        quarter: data.quarter,
        year: data.year,
        keyResults,
      });
      toast.success('Goal created!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create goal');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-lg">
        <DialogHeader><DialogTitle>Add Performance Goal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Objective Title <span className="text-danger">*</span></Label>
            <Input {...register('title')} placeholder="e.g. Improve customer satisfaction" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
            {errors.title && <p className="text-danger text-xs">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Description</Label>
            <textarea {...register('description')} placeholder="Describe the goal..." rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Quarter</Label>
              <select {...register('quarter')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Year</Label>
              <Input type="number" {...register('year')} className="bg-surface-2 border-border text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Target Date</Label>
              <Input type="date" {...register('targetDate')} className="bg-surface-2 border-border text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-gray-300">Key Results</Label>
            {[1, 2, 3].map((n) => (
              <div key={n} className="grid grid-cols-3 gap-2 items-start">
                <div className="col-span-2 space-y-1">
                  <input {...register(`kr${n}Title` as keyof GoalForm)} placeholder={`KR ${n}: ${n === 1 ? 'Required' : 'Optional'}...`}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-accent" />
                </div>
                <input type="number" {...register(`kr${n}Target` as keyof GoalForm)} placeholder="Target" min={1}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-accent" />
              </div>
            ))}
            {errors.kr1Title && <p className="text-danger text-xs">{errors.kr1Title.message}</p>}
          </div>
          <Button type="submit" className="w-full gradient-accent text-white" isLoading={isSubmitting}>Create Goal</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal }: { goal: PerformanceGoal }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 text-left">
          <Target size={16} className="text-accent shrink-0" />
          <div>
            <p className="text-white font-medium">{goal.title}</p>
            <p className="text-gray-500 text-xs">{goal.quarter} {goal.year} &bull; Due {format(parseISO(goal.targetDate), 'MMM d, yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-accent font-bold text-sm">{goal.progress}%</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-border">
          {goal.description && <p className="text-gray-400 text-sm pt-3">{goal.description}</p>}
          <div className="space-y-3 pt-2">
            {(goal.keyResults ?? []).map((kr) => {
              const pct = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0;
              return (
                <div key={kr.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{kr.title}</span>
                    <span className="text-gray-400">{kr.current}/{kr.target} {kr.unit ?? '%'} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full gradient-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Performance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [score, setScore] = useState<{ attendanceRate: number; bddCompletionRate: number; avgProgressScore: number; okrProgress: number; overallScore: number; streak: number } | null>(null);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [teamPerf, setTeamPerf] = useState<{ userId: string; user: { name: string; department: string }; attendanceRate: number; bddCompletionRate: number; avgProgressScore: number; okrProgress: number; overallScore: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreRes, goalsRes] = await Promise.all([
        performanceApi.getMyPerformanceScore(),
        performanceApi.getMyGoals(),
      ]);
      setScore((scoreRes as { data: typeof score }).data);
      setGoals(((goalsRes as { data: PerformanceGoal[] }).data) ?? []);

      if (isAdmin) {
        const teamRes = await performanceApi.getTeamPerformance();
        setTeamPerf(((teamRes as { data: typeof teamPerf }).data) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance</h1>
          <p className="text-gray-400 text-sm mt-1">Track goals and performance metrics</p>
        </div>
        <Button onClick={() => setGoalDialogOpen(true)} className="gradient-accent text-white">
          <Plus size={16} /> Add Goal
        </Button>
      </div>

      {isAdmin && (
        <div className="flex bg-surface-2 rounded-xl p-1 gap-1 w-fit">
          {(['my', 'team'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}>
              {tab === 'my' ? 'My Performance' : 'Team'}
            </button>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {activeTab === 'my' && score && (
            <div className="space-y-5">
              {/* Score gauge */}
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-center gap-8">
                  <CircularGauge value={Math.round(score.overallScore)} size={140} />
                  <div className="flex-1 space-y-2">
                    <h2 className="text-white font-semibold text-lg">Overall Performance Score</h2>
                    <p className="text-gray-400 text-sm">Based on attendance, daily pulse, progress, and OKR completion</p>
                    {score.streak > 0 && (
                      <div className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${score.streak >= 5 ? 'bg-warning/10 text-warning' : 'bg-surface-2 text-gray-300'}`}>
                        {score.streak >= 5 ? <Flame size={14} /> : <TrendingUp size={14} />}
                        {score.streak} day BDD streak
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <ScoreCard label="Attendance Rate" value={score.attendanceRate} color="text-success" />
                <ScoreCard label="BDD Completion" value={score.bddCompletionRate} color="text-accent" />
                <ScoreCard label="Avg Progress Score" value={score.avgProgressScore} color="text-warning" />
                <ScoreCard label="OKR Progress" value={score.okrProgress} color="text-blue-400" />
              </div>

              {/* Goals */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold">Objectives & Key Results</h2>
                  <span className="text-gray-500 text-sm">{goals.length} goals</span>
                </div>
                {goals.length === 0 ? (
                  <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
                    <Target size={36} className="mx-auto mb-3 opacity-30" />
                    <p>No goals set yet</p>
                    <Button onClick={() => setGoalDialogOpen(true)} variant="outline" size="sm" className="mt-3">Add your first goal</Button>
                  </div>
                ) : goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
              </div>
            </div>
          )}

          {activeTab === 'team' && isAdmin && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                      <th className="px-5 py-3 text-left">Employee</th>
                      <th className="px-5 py-3 text-right">Attendance %</th>
                      <th className="px-5 py-3 text-right">BDD %</th>
                      <th className="px-5 py-3 text-right">Progress</th>
                      <th className="px-5 py-3 text-right">OKR</th>
                      <th className="px-5 py-3 text-right">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerf.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No performance data</td></tr>
                    ) : teamPerf.sort((a, b) => b.overallScore - a.overallScore).map((p, i) => (
                      <tr key={p.userId} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {i === 0 && <span className="text-warning text-xs">🏆</span>}
                            <div>
                              <p className="text-white text-sm font-medium">{p.user.name}</p>
                              <p className="text-gray-500 text-xs">{p.user.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-medium ${p.attendanceRate >= 80 ? 'text-success' : 'text-warning'}`}>{p.attendanceRate.toFixed(0)}%</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-medium ${p.bddCompletionRate >= 80 ? 'text-success' : 'text-warning'}`}>{p.bddCompletionRate.toFixed(0)}%</span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-300 text-sm">{p.avgProgressScore.toFixed(0)}%</td>
                        <td className="px-5 py-3 text-right text-gray-300 text-sm">{p.okrProgress.toFixed(0)}%</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold text-sm ${p.overallScore >= 80 ? 'text-success' : p.overallScore >= 60 ? 'text-warning' : 'text-danger'}`}>
                            {p.overallScore.toFixed(0)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <GoalDialog open={goalDialogOpen} onClose={() => setGoalDialogOpen(false)} onSuccess={loadData} />
    </div>
  );
}
