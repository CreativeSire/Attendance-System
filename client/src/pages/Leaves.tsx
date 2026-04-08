import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, differenceInBusinessDays, addDays } from 'date-fns';
import { Plus, CalendarDays, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { leavesApi } from '@/api/leaves';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { LeaveRequest } from '@/types';
import { getStatusBg } from '@/lib/utils';

const leaveSchema = z.object({
  type: z.string().min(1, 'Required'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  reason: z.string().min(5, 'Please provide a reason'),
});

type LeaveForm = z.infer<typeof leaveSchema>;

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

function LeaveTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ANNUAL: 'bg-blue-400/20 text-blue-400',
    SICK: 'bg-danger/20 text-danger',
    CASUAL: 'bg-warning/20 text-warning',
    MATERNITY: 'bg-pink-400/20 text-pink-400',
    PATERNITY: 'bg-purple-400/20 text-purple-400',
    UNPAID: 'bg-gray-400/20 text-gray-400',
  };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[type] ?? 'bg-accent/20 text-accent'}`}>{type}</span>;
}

function RequestLeaveDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  let days = 0;
  if (startDate && endDate) {
    try {
      days = Math.max(1, differenceInBusinessDays(parseISO(endDate), parseISO(startDate)) + 1);
    } catch { /* ignore */ }
  }

  const onSubmit = async (data: LeaveForm) => {
    try {
      await leavesApi.request(data);
      toast.success('Leave request submitted!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Request Leave</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Leave Type <span className="text-danger">*</span></Label>
            <select {...register('type')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
              <option value="">Select type...</option>
              {['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'UNPAID'].map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()} Leave</option>
              ))}
            </select>
            {errors.type && <p className="text-danger text-xs">{errors.type.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Start Date <span className="text-danger">*</span></Label>
              <Input type="date" {...register('startDate')} className="bg-surface-2 border-border text-white" min={format(new Date(), 'yyyy-MM-dd')} />
              {errors.startDate && <p className="text-danger text-xs">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">End Date <span className="text-danger">*</span></Label>
              <Input type="date" {...register('endDate')} className="bg-surface-2 border-border text-white" min={startDate || format(new Date(), 'yyyy-MM-dd')} />
              {errors.endDate && <p className="text-danger text-xs">{errors.endDate.message}</p>}
            </div>
          </div>

          {days > 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg px-4 py-2 text-center">
              <span className="text-accent font-bold text-lg">{days}</span>
              <span className="text-gray-400 text-sm ml-1">business day{days !== 1 ? 's' : ''}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-gray-300">Reason <span className="text-danger">*</span></Label>
            <textarea {...register('reason')} placeholder="Explain your reason for leave..." rows={3}
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
            {errors.reason && <p className="text-danger text-xs">{errors.reason.message}</p>}
          </div>

          <Button type="submit" className="w-full gradient-accent text-white" isLoading={isSubmitting}>
            Submit Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(note); onClose(); setNote(''); } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-sm">
        <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejection (optional)..." rows={3}
            className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
          <Button onClick={handle} isLoading={loading} variant="destructive" className="w-full">Confirm Reject</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Leaves() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'all'>('my');
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<{ annual: number; sick: number; casual: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, balRes] = await Promise.all([
        leavesApi.getMyLeaves({ limit: 100 }),
        leavesApi.getBalance(),
      ]);
      setMyLeaves(((myRes as { data: { data: LeaveRequest[] } }).data?.data) ?? []);
      setBalance((balRes as { data: { annual: number; sick: number; casual: number } }).data);

      if (isAdmin) {
        const teamRes = await leavesApi.getTeamLeaves({ limit: 200 });
        setTeamLeaves(((teamRes as { data: { data: LeaveRequest[] } }).data?.data) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: string) => {
    try {
      await leavesApi.approve(id);
      toast.success('Leave approved');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleReject = async (note: string) => {
    if (!rejectTarget) return;
    await leavesApi.reject(rejectTarget, note);
    toast.success('Leave rejected');
    loadData();
  };

  const pendingTeamLeaves = teamLeaves.filter((l) => l.status === 'PENDING');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leave Management</h1>
          <p className="text-gray-400 text-sm mt-1">Request and manage leaves</p>
        </div>
        <Button onClick={() => setRequestOpen(true)} className="gradient-accent text-white">
          <Plus size={16} /> Request Leave
        </Button>
      </div>

      {/* Balance cards */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Annual Leave', used: 20 - (balance.annual ?? 0), total: 20, color: 'bg-blue-400', text: 'text-blue-400' },
            { label: 'Sick Leave', used: 10 - (balance.sick ?? 0), total: 10, color: 'bg-danger', text: 'text-danger' },
            { label: 'Casual Leave', used: 5 - (balance.casual ?? 0), total: 5, color: 'bg-warning', text: 'text-warning' },
            { label: 'Study Leave', used: 0, total: 5, color: 'bg-accent', text: 'text-accent' },
          ].map((b) => (
            <div key={b.label} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-2">{b.label}</p>
              <div className="flex items-end gap-1 mb-2">
                <span className={`text-2xl font-bold ${b.text}`}>{b.used}</span>
                <span className="text-gray-500 text-sm mb-0.5">/{b.total} used</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, (b.used / b.total) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {isAdmin && (
        <div className="flex bg-surface-2 rounded-xl p-1 gap-1 w-fit">
          {([
            { key: 'my', label: 'My Requests' },
            { key: 'pending', label: `Pending (${pendingTeamLeaves.length})` },
            { key: 'all', label: 'All Leaves' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.key ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {activeTab === 'my' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-white font-medium">My Leave Requests</h3>
              </div>
              {myLeaves.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <CalendarDays size={36} className="mx-auto mb-3 opacity-30" />
                  <p>No leave requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                        <th className="px-5 py-3 text-left">Type</th>
                        <th className="px-5 py-3 text-left">Dates</th>
                        <th className="px-5 py-3 text-left">Days</th>
                        <th className="px-5 py-3 text-left">Reason</th>
                        <th className="px-5 py-3 text-left">Status</th>
                        <th className="px-5 py-3 text-left">Applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myLeaves.map((leave) => (
                        <tr key={leave.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                          <td className="px-5 py-3"><LeaveTypeBadge type={leave.type} /></td>
                          <td className="px-5 py-3 text-gray-300 text-sm">
                            {format(parseISO(leave.startDate), 'MMM d')} &ndash; {format(parseISO(leave.endDate), 'MMM d, yyyy')}
                          </td>
                          <td className="px-5 py-3 text-gray-300 text-sm">{leave.days}</td>
                          <td className="px-5 py-3 text-gray-400 text-sm max-w-xs truncate">{leave.reason}</td>
                          <td className="px-5 py-3"><StatusBadge status={leave.status} /></td>
                          <td className="px-5 py-3 text-gray-500 text-sm">{format(parseISO(leave.createdAt), 'MMM d')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingTeamLeaves.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
                  <CheckCircle size={36} className="mx-auto mb-3 text-success opacity-50" />
                  <p>No pending leave requests</p>
                </div>
              ) : pendingTeamLeaves.map((leave) => (
                <div key={leave.id} className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 gradient-accent rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(leave.user?.name ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-white font-medium">{leave.user?.name}</p>
                        <p className="text-gray-500 text-xs">{leave.user?.department}</p>
                      </div>
                    </div>
                    <LeaveTypeBadge type={leave.type} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">From</p>
                      <p className="text-white">{format(parseISO(leave.startDate), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">To</p>
                      <p className="text-white">{format(parseISO(leave.endDate), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Days</p>
                      <p className="text-white font-bold">{leave.days}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-gray-400 text-sm bg-surface-2 rounded-lg p-3">{leave.reason}</p>
                  <div className="mt-4 flex gap-3">
                    <Button variant="success" size="sm" className="flex-1" onClick={() => handleApprove(leave.id)}>
                      <CheckCircle size={14} /> Approve
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => setRejectTarget(leave.id)}>
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                      <th className="px-5 py-3 text-left">Employee</th>
                      <th className="px-5 py-3 text-left">Type</th>
                      <th className="px-5 py-3 text-left">Dates</th>
                      <th className="px-5 py-3 text-left">Days</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-left">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLeaves.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No records found</td></tr>
                    ) : teamLeaves.map((leave) => (
                      <tr key={leave.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-white text-sm font-medium">{leave.user?.name}</p>
                          <p className="text-gray-500 text-xs">{leave.user?.department}</p>
                        </td>
                        <td className="px-5 py-3"><LeaveTypeBadge type={leave.type} /></td>
                        <td className="px-5 py-3 text-gray-300 text-sm">
                          {format(parseISO(leave.startDate), 'MMM d')} &ndash; {format(parseISO(leave.endDate), 'MMM d')}
                        </td>
                        <td className="px-5 py-3 text-gray-300 text-sm">{leave.days}</td>
                        <td className="px-5 py-3"><StatusBadge status={leave.status} /></td>
                        <td className="px-5 py-3 text-gray-500 text-sm">{format(parseISO(leave.createdAt), 'MMM d')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <RequestLeaveDialog open={requestOpen} onClose={() => setRequestOpen(false)} onSuccess={loadData} />
      <RejectDialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={handleReject} />
    </div>
  );
}
