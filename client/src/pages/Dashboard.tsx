import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Users, Clock, UserX, CalendarOff, ShieldCheck, FileText, DollarSign,
  TrendingUp, ArrowRight, Megaphone, CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/api/client';
import { attendanceApi } from '@/api/attendance';
import { bddApi } from '@/api/bdd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardData, AttendanceRecord, BDDCheckIn } from '@/types';
import { formatTime, getInitials } from '@/lib/utils';

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number | string; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-gray-400 text-sm mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PRESENT') return <Badge variant="success">On Time</Badge>;
  if (status === 'LATE') return <Badge variant="warning">Late</Badge>;
  return <Badge variant="secondary">Out</Badge>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  return isAdmin ? <AdminDashboard /> : <EmployeeDashboard />;
}

function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<{ data: DashboardData; success: boolean }>('/admin/dashboard');
        setData(res.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Spinner />;
  if (error) return (
    <div className="bg-danger/10 border border-danger/30 rounded-xl p-6 text-danger">{error}</div>
  );
  if (!data) return null;

  const { todayStats, liveFeed, pendingLeaves, pendingExpenses, pendingCorrections, broadcasts, weeklyChart } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Present Today" value={todayStats.present} icon={Users} color="text-success" bg="bg-success/10" />
        <StatCard label="Late" value={todayStats.late} icon={Clock} color="text-warning" bg="bg-warning/10" />
        <StatCard label="Absent" value={todayStats.absent} icon={UserX} color="text-danger" bg="bg-danger/10" />
        <StatCard label="On Leave" value={todayStats.onLeave} icon={CalendarOff} color="text-blue-400" bg="bg-blue-400/10" />
      </div>

      {/* Broadcasts */}
      {broadcasts && broadcasts.length > 0 && (
        <div className="space-y-2">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3">
              <Megaphone size={18} className="text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">{b.title}</p>
                <p className="text-gray-400 text-sm mt-0.5">{b.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Who's In table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-white font-semibold">Who&apos;s In Today</h2>
          <span className="text-gray-400 text-sm">{liveFeed?.length ?? 0} checked in</span>
        </div>
        {!liveFeed || liveFeed.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p>No one has checked in yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Department</th>
                  <th className="px-5 py-3 text-left">Clock In</th>
                  <th className="px-5 py-3 text-left">Entry Point</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Mood</th>
                </tr>
              </thead>
              <tbody>
                {liveFeed.map((rec: AttendanceRecord) => (
                  <tr key={rec.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 gradient-accent rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {getInitials(rec.user?.name ?? '?')}
                        </div>
                        <span className="text-white text-sm font-medium">{rec.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-sm">{rec.user?.department}</td>
                    <td className="px-5 py-3 text-gray-300 text-sm font-mono">{rec.clockIn ? formatTime(rec.clockIn) : '--'}</td>
                    <td className="px-5 py-3 text-gray-400 text-sm">{rec.entryPoint?.name ?? '--'}</td>
                    <td className="px-5 py-3"><StatusBadge status={rec.status} /></td>
                    <td className="px-5 py-3 text-lg">{rec.mood ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom 2-col */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly chart */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Weekly Overview</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyChart ?? []} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar dataKey="present" name="Present" fill="#2ecc71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="Late" fill="#e67e22" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pending approvals */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Pending Approvals</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
                  <CalendarOff size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Leave Requests</p>
                  <p className="text-gray-500 text-xs">Awaiting approval</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-blue-400/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full">{pendingLeaves}</span>
                <Link to="/leaves" className="text-accent text-xs hover:underline flex items-center gap-1">Review <ArrowRight size={12} /></Link>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                  <DollarSign size={16} className="text-warning" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Expenses</p>
                  <p className="text-gray-500 text-xs">Awaiting approval</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-warning/20 text-warning text-xs font-bold px-2 py-1 rounded-full">{pendingExpenses}</span>
                <Link to="/expenses" className="text-accent text-xs hover:underline flex items-center gap-1">Review <ArrowRight size={12} /></Link>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-danger/10 rounded-lg flex items-center justify-center">
                  <FileText size={16} className="text-danger" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Corrections</p>
                  <p className="text-gray-500 text-xs">Time correction requests</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-danger/20 text-danger text-xs font-bold px-2 py-1 rounded-full">{pendingCorrections}</span>
                <Link to="/admin" className="text-accent text-xs hover:underline flex items-center gap-1">Review <ArrowRight size={12} /></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [myStats, setMyStats] = useState<{ presentDays: number; lateDays: number; attendanceRate: number } | null>(null);
  const [todayBDD, setTodayBDD] = useState<BDDCheckIn | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, statsRes, bddRes] = await Promise.allSettled([
          attendanceApi.getTodayStatus(),
          attendanceApi.getMyStats(),
          bddApi.getTodayBDD(),
        ]);

        if (statusRes.status === 'fulfilled') setTodayRecord((statusRes.value as { data: AttendanceRecord | null }).data);
        if (statsRes.status === 'fulfilled') setMyStats((statsRes.value as { data: typeof myStats }).data);
        if (bddRes.status === 'fulfilled') setTodayBDD((bddRes.value as { data: BDDCheckIn | null }).data);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <Spinner />;

  const now = new Date();
  const month = format(now, 'MMMM yyyy');
  const leaveBalance = (user?.annualLeaveBalance ?? 0) + (user?.sickLeaveBalance ?? 0) + (user?.casualLeaveBalance ?? 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm">Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'},</p>
            <h1 className="text-2xl font-bold text-white mt-1">{user?.name} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">{format(now, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="text-right">
            <Badge variant={user?.role === 'manager' ? 'default' : 'secondary'}>{user?.role}</Badge>
            <p className="text-gray-500 text-xs mt-2">{user?.department}</p>
          </div>
        </div>
      </div>

      {/* Today status */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Today&apos;s Status</h2>
        {todayRecord ? (
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Clocked In</p>
              <p className="text-3xl font-bold text-success font-mono">{todayRecord.clockIn ? formatTime(todayRecord.clockIn) : '--:--'}</p>
            </div>
            {todayRecord.clockOut && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Clocked Out</p>
                <p className="text-3xl font-bold text-warning font-mono">{formatTime(todayRecord.clockOut)}</p>
              </div>
            )}
            {todayRecord.workHours && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Hours Worked</p>
                <p className="text-3xl font-bold text-accent font-mono">{todayRecord.workHours.toFixed(1)}h</p>
              </div>
            )}
            <div className="ml-auto">
              <StatusBadge status={todayRecord.status} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400">You haven&apos;t clocked in yet today</p>
              <p className="text-gray-500 text-sm mt-1">Tap the button to clock in</p>
            </div>
            <Link to="/clock-in">
              <Button className="gradient-accent text-white">
                <ShieldCheck size={16} /> Start Verification
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-success">{myStats?.attendanceRate?.toFixed(0) ?? 0}%</div>
          <div className="text-gray-500 text-xs mt-1">Attendance ({month})</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-warning">{myStats?.lateDays ?? 0}</div>
          <div className="text-gray-500 text-xs mt-1">Late Days</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{leaveBalance}</div>
          <div className="text-gray-500 text-xs mt-1">Leave Balance</div>
        </div>
      </div>

      {/* Today's priorities from BDD */}
      {todayBDD && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={16} className="text-success" />
            <h2 className="text-white font-semibold">Today&apos;s Priorities</h2>
          </div>
          <ol className="space-y-2">
            {[todayBDD.todayPriority1 ?? todayBDD.mondayPriority1, todayBDD.todayPriority2 ?? todayBDD.mondayPriority2, todayBDD.todayPriority3 ?? todayBDD.mondayPriority3]
              .filter(Boolean).slice(0, 3)
              .map((priority, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                  <span className="text-gray-300">{priority}</span>
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/clock-in">
            <Button variant="outline" className="w-full flex-col h-auto py-4 gap-2">
              <ShieldCheck size={20} />
              <span className="text-xs">Clock In/Out</span>
            </Button>
          </Link>
          <Link to="/bdd">
            <Button variant="outline" className="w-full flex-col h-auto py-4 gap-2">
              <TrendingUp size={20} />
              <span className="text-xs">Daily Pulse</span>
            </Button>
          </Link>
          <Link to="/leaves">
            <Button variant="outline" className="w-full flex-col h-auto py-4 gap-2">
              <CalendarOff size={20} />
              <span className="text-xs">Request Leave</span>
            </Button>
          </Link>
          <Link to="/expenses">
            <Button variant="outline" className="w-full flex-col h-auto py-4 gap-2">
              <DollarSign size={20} />
              <span className="text-xs">Log Expense</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
