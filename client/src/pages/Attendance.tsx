import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { attendanceApi } from '@/api/attendance';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { AttendanceRecord, CorrectionRequest } from '@/types';
import { formatTime, getStatusBg, MONTHS } from '@/lib/utils';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = getStatusBg(status);
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
}

function MonthYearSelector({ month, year, onChange }: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const prev = () => { if (month === 1) onChange(12, year - 1); else onChange(month - 1, year); };
  const next = () => { if (month === 12) onChange(1, year + 1); else onChange(month + 1, year); };
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-2 rounded-lg bg-surface-2 text-gray-400 hover:text-white hover:bg-surface-2/80 transition-colors">
        <ChevronLeft size={16} />
      </button>
      <span className="text-white font-medium px-2">{MONTHS[month - 1]} {year}</span>
      <button onClick={next} className="p-2 rounded-lg bg-surface-2 text-gray-400 hover:text-white hover:bg-surface-2/80 transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function AttendanceCalendar({ records, month, year }: { records: AttendanceRecord[]; month: number; year: number }) {
  const firstDay = startOfMonth(new Date(year, month - 1, 1));
  const lastDay = endOfMonth(firstDay);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startOffset = getDay(firstDay); // 0=Sunday

  const recordByDate: Record<string, AttendanceRecord> = {};
  records.forEach((r) => {
    const d = r.date.slice(0, 10);
    recordByDate[d] = r;
  });

  const dotColor = (status?: string) => {
    if (!status) return 'bg-gray-600';
    if (status === 'PRESENT') return 'bg-success';
    if (status === 'LATE') return 'bg-warning';
    if (status === 'ABSENT') return 'bg-danger';
    return 'bg-blue-400';
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h3 className="text-white font-medium mb-4">Calendar</h3>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-gray-500 text-xs py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const rec = recordByDate[dateStr];
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          const isFuture = day > new Date();
          return (
            <div
              key={dateStr}
              title={rec ? `${rec.status} - ${rec.clockIn ? formatTime(rec.clockIn) : 'No clock in'}` : ''}
              className={`relative flex flex-col items-center justify-center rounded-lg p-1.5 aspect-square transition-colors
                ${isFuture ? 'opacity-30' : isWeekend ? 'bg-surface-2/30' : rec ? 'bg-surface-2 cursor-pointer hover:bg-surface-2/80' : 'hover:bg-surface-2/50'}`}
            >
              <span className={`text-xs ${isFuture || isWeekend ? 'text-gray-600' : rec ? 'text-white' : 'text-gray-500'}`}>
                {format(day, 'd')}
              </span>
              {rec && !isFuture && (
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor(rec.status)}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CorrectionDialog({ record, open, onClose, onSubmit }: {
  record: AttendanceRecord | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; requestedClockIn?: string; requestedClockOut?: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    setLoading(true);
    try {
      await onSubmit({ reason, requestedClockIn: clockIn || undefined, requestedClockOut: clockOut || undefined });
      onClose();
      setReason(''); setClockIn(''); setClockOut('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Request Correction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {record && (
            <div className="bg-surface-2 rounded-lg p-3 text-sm text-gray-400">
              <p>Date: <span className="text-white">{format(parseISO(record.date), 'MMM d, yyyy')}</span></p>
              <p>Clock In: <span className="text-white font-mono">{record.clockIn ? formatTime(record.clockIn) : '--'}</span></p>
              <p>Clock Out: <span className="text-white font-mono">{record.clockOut ? formatTime(record.clockOut) : '--'}</span></p>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-gray-300">Reason <span className="text-danger">*</span></Label>
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this correction is needed..."
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Correct Clock In</Label>
              <Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="bg-surface-2 border-border text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Correct Clock Out</Label>
              <Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="bg-surface-2 border-border text-white" />
            </div>
          </div>
          <Button onClick={handleSubmit} isLoading={loading} className="w-full gradient-accent text-white">
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [teamRecords, setTeamRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<{ presentDays: number; lateDays: number; absentDays: number; totalWorkHours: number; overtimeHours: number; attendanceRate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);

  const loadMyData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, st] = await Promise.all([
        attendanceApi.getMyAttendance({ month, year, limit: 100 }),
        attendanceApi.getMyStats({ month, year }),
      ]);
      setRecords(((recs as { data: { data: AttendanceRecord[] } }).data?.data) ?? []);
      setStats((st as { data: typeof stats }).data);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const loadTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getTeamAttendance({ month, year, limit: 200 });
      setTeamRecords(((res as { data: { data: AttendanceRecord[] } }).data?.data) ?? []);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (activeTab === 'my') loadMyData(); else loadTeamData();
  }, [activeTab, loadMyData, loadTeamData]);

  const handleRequestCorrection = async (data: { reason: string; requestedClockIn?: string; requestedClockOut?: string }) => {
    if (!correctionRecord) return;
    try {
      await attendanceApi.requestCorrection(correctionRecord.id, data);
      toast.success('Correction request submitted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit correction');
      throw err;
    }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teamRecords.map((r) => ({
      Employee: r.user?.name ?? '--',
      Department: r.user?.department ?? '--',
      Date: format(parseISO(r.date), 'MMM d, yyyy'),
      'Clock In': r.clockIn ? formatTime(r.clockIn) : '--',
      'Clock Out': r.clockOut ? formatTime(r.clockOut) : '--',
      Hours: r.workHours?.toFixed(1) ?? '--',
      Status: r.status,
      'Entry Point': r.entryPoint?.name ?? '--',
      Mood: r.mood ?? '',
      BDD: r.bddSubmitted ? 'Yes' : 'No',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance-${MONTHS[month - 1]}-${year}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-gray-400 text-sm mt-1">Track attendance records</p>
        </div>
        <MonthYearSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex bg-surface-2 rounded-xl p-1 gap-1 w-fit">
          {(['my', 'team'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize
                ${activeTab === tab ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {tab === 'my' ? 'My Attendance' : 'Team'}
            </button>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : activeTab === 'my' ? (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Present', value: stats?.presentDays ?? 0, color: 'text-success' },
              { label: 'Late', value: stats?.lateDays ?? 0, color: 'text-warning' },
              { label: 'Total Hours', value: `${stats?.totalWorkHours?.toFixed(0) ?? 0}h`, color: 'text-accent' },
              { label: 'Overtime', value: `${stats?.overtimeHours?.toFixed(0) ?? 0}h`, color: 'text-blue-400' },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-gray-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <AttendanceCalendar records={records} month={month} year={year} />

          {/* Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-white font-medium">Records</h3>
            </div>
            {records.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No records for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Day</th>
                      <th className="px-5 py-3 text-left">Clock In</th>
                      <th className="px-5 py-3 text-left">Clock Out</th>
                      <th className="px-5 py-3 text-left">Hours</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-left">BDD</th>
                      <th className="px-5 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr key={rec.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                        <td className="px-5 py-3 text-gray-300 text-sm">{format(parseISO(rec.date), 'MMM d')}</td>
                        <td className="px-5 py-3 text-gray-500 text-sm">{format(parseISO(rec.date), 'EEE')}</td>
                        <td className="px-5 py-3 text-gray-300 text-sm font-mono">{rec.clockIn ? formatTime(rec.clockIn) : '--'}</td>
                        <td className="px-5 py-3 text-gray-300 text-sm font-mono">{rec.clockOut ? formatTime(rec.clockOut) : '--'}</td>
                        <td className="px-5 py-3 text-gray-300 text-sm">{rec.workHours?.toFixed(1) ?? '--'}</td>
                        <td className="px-5 py-3"><StatusBadge status={rec.status} /></td>
                        <td className="px-5 py-3">
                          {rec.bddSubmitted
                            ? <span className="text-success text-sm">&#10003;</span>
                            : <span className="text-danger text-sm">&#10007;</span>}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setCorrectionRecord(rec)}
                            className="text-xs text-accent hover:underline flex items-center gap-1"
                          >
                            <AlertCircle size={12} /> Correct
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download size={14} /> Export Excel
            </Button>
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                    <th className="px-5 py-3 text-left">Employee</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Clock In</th>
                    <th className="px-5 py-3 text-left">Clock Out</th>
                    <th className="px-5 py-3 text-left">Hours</th>
                    <th className="px-5 py-3 text-left">Entry Point</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Mood</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRecords.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-500">No team records for this period</td></tr>
                  ) : teamRecords.map((rec) => (
                    <tr key={rec.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-sm">
                          <p className="text-white font-medium">{rec.user?.name}</p>
                          <p className="text-gray-500 text-xs">{rec.user?.department}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-300 text-sm">{format(parseISO(rec.date), 'MMM d')}</td>
                      <td className="px-5 py-3 text-gray-300 text-sm font-mono">{rec.clockIn ? formatTime(rec.clockIn) : '--'}</td>
                      <td className="px-5 py-3 text-gray-300 text-sm font-mono">{rec.clockOut ? formatTime(rec.clockOut) : '--'}</td>
                      <td className="px-5 py-3 text-gray-300 text-sm">{rec.workHours?.toFixed(1) ?? '--'}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{rec.entryPoint?.name ?? '--'}</td>
                      <td className="px-5 py-3"><StatusBadge status={rec.status} /></td>
                      <td className="px-5 py-3 text-lg">{rec.mood ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <CorrectionDialog
        record={correctionRecord}
        open={!!correctionRecord}
        onClose={() => setCorrectionRecord(null)}
        onSubmit={handleRequestCorrection}
      />
    </div>
  );
}
