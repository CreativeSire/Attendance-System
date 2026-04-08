import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, QrCode, ExternalLink, Megaphone, CheckCircle, XCircle, Trash2, ToggleLeft, ToggleRight, Users, Clock, UserX, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { qrApi } from '@/api/qr';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { EntryPoint, BroadcastMessage, AttendanceStats, AttendanceRecord, CorrectionRequest, DashboardData } from '@/types';
import { getInitials, getStatusBg, formatTime } from '@/lib/utils';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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

// -------- Overview Tab --------
function OverviewTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: DashboardData; success: boolean }>('/admin/dashboard')
      .then((res) => setData((res as { data: DashboardData }).data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <div className="text-gray-500 text-center py-10">No data available</div>;

  const { todayStats, liveFeed, pendingLeaves, pendingExpenses, pendingCorrections } = data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Present" value={todayStats.present} icon={Users} color="text-success" bg="bg-success/10" />
        <StatCard label="Late" value={todayStats.late} icon={Clock} color="text-warning" bg="bg-warning/10" />
        <StatCard label="Absent" value={todayStats.absent} icon={UserX} color="text-danger" bg="bg-danger/10" />
        <StatCard label="On Leave" value={todayStats.onLeave} icon={CalendarOff} color="text-blue-400" bg="bg-blue-400/10" />
      </div>

      {/* Pending summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Leaves', value: pendingLeaves, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Pending Expenses', value: pendingExpenses, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Pending Corrections', value: pendingCorrections, color: 'text-danger', bg: 'bg-danger/10' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border border-current/20 rounded-xl p-4 text-center`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Live feed */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-white font-semibold">Live Employee Feed</h3>
          <span className="text-gray-400 text-sm">{liveFeed?.length ?? 0} checked in</span>
        </div>
        {!liveFeed || liveFeed.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No one has checked in today</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Dept</th>
                  <th className="px-5 py-3 text-left">Clock In</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {liveFeed.map((rec: AttendanceRecord) => (
                  <tr key={rec.id} className="border-b border-border/50 hover:bg-surface-2/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 gradient-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {getInitials(rec.user?.name ?? '?')}
                        </div>
                        <span className="text-white text-sm">{rec.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-sm">{rec.user?.department}</td>
                    <td className="px-5 py-3 text-gray-300 text-sm font-mono">{rec.clockIn ? formatTime(rec.clockIn) : '--'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusBg(rec.status)}`}>{rec.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------- Entry Points Tab --------
function AddEntryPointDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) { toast.error('Name and location are required'); return; }
    setSaving(true);
    try {
      await qrApi.createEntryPoint({ name: name.trim(), location: location.trim() });
      toast.success('Entry point created');
      setName(''); setLocation('');
      onSuccess(); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create entry point');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-sm">
        <DialogHeader><DialogTitle>Add Entry Point</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Name <span className="text-danger">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Entrance" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Location <span className="text-danger">*</span></Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ground Floor, Block A" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
          </div>
          <Button type="submit" className="w-full gradient-accent text-white" isLoading={saving}>Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QRModal({ entryPoint, open, onClose }: { entryPoint: EntryPoint | null; open: boolean; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && entryPoint) {
      setLoading(true);
      qrApi.getEntryQR(entryPoint.id)
        .then((res) => setQrUrl((res as { data: { qrDataUrl: string } }).data?.qrDataUrl ?? null))
        .catch(() => toast.error('Failed to load QR'))
        .finally(() => setLoading(false));
    }
  }, [open, entryPoint]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-sm text-center">
        <DialogHeader><DialogTitle>{entryPoint?.name} QR Code</DialogTitle></DialogHeader>
        {loading ? <Spinner /> : qrUrl ? (
          <div className="flex flex-col items-center gap-3 pt-2">
            <img src={qrUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
            <p className="text-gray-400 text-xs">Scan with Dala app to clock in at {entryPoint?.location}</p>
          </div>
        ) : <p className="text-gray-500 py-8">QR code not available</p>}
      </DialogContent>
    </Dialog>
  );
}

function EntryPointsTab() {
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<EntryPoint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await qrApi.getEntryPoints();
      setEntryPoints(((res as { data: EntryPoint[] }).data) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (ep: EntryPoint) => {
    try {
      await qrApi.updateEntryPoint(ep.id, { active: !ep.active });
      toast.success(`Entry point ${ep.active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry point?')) return;
    try {
      await qrApi.deleteEntryPoint(id);
      toast.success('Entry point deleted');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} className="gradient-accent text-white">
          <Plus size={16} /> Add Entry Point
        </Button>
      </div>

      {loading ? <Spinner /> : entryPoints.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
          <QrCode size={36} className="mx-auto mb-3 opacity-30" />
          <p>No entry points configured</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Location</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entryPoints.map((ep) => (
                <tr key={ep.id} className="border-b border-border/50 hover:bg-surface-2/50">
                  <td className="px-5 py-3 text-white font-medium text-sm">{ep.name}</td>
                  <td className="px-5 py-3 text-gray-400 text-sm">{ep.location}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleActive(ep)} className="hover:opacity-80 transition-opacity">
                      {ep.active
                        ? <ToggleRight size={24} className="text-success" />
                        : <ToggleLeft size={24} className="text-gray-500" />}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <a href={`/entry/${ep.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-accent hover:underline text-xs flex items-center gap-1">
                        <ExternalLink size={12} /> Open Screen
                      </a>
                      <button onClick={() => setQrTarget(ep)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1 ml-2">
                        <QrCode size={12} /> QR
                      </button>
                      <button onClick={() => handleDelete(ep.id)} className="text-danger hover:text-danger/80 ml-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEntryPointDialog open={addOpen} onClose={() => setAddOpen(false)} onSuccess={load} />
      <QRModal entryPoint={qrTarget} open={!!qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}

// -------- Broadcasts Tab --------
function SendBroadcastDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('ALL');
  const [expiresIn, setExpiresIn] = useState('24');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error('Title and message are required'); return; }
    setSaving(true);
    try {
      const expiresAt = expiresIn !== 'never'
        ? new Date(Date.now() + parseInt(expiresIn) * 60 * 60 * 1000).toISOString()
        : undefined;
      await api.post('/broadcasts', {
        title: title.trim(),
        message: message.trim(),
        targetDepartment: target === 'ALL' ? undefined : target,
        expiresAt,
      });
      toast.success('Broadcast sent!');
      setTitle(''); setMessage(''); setTarget('ALL'); setExpiresIn('24');
      onSuccess(); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send broadcast');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-md">
        <DialogHeader><DialogTitle>Send Broadcast</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Title <span className="text-danger">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Broadcast title..." className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Message <span className="text-danger">*</span></Label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message..." rows={4}
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Target</Label>
              <select value={target} onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
                <option value="ALL">All Employees</option>
                {['Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Expires In</Label>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
                <option value="1">1 Hour</option>
                <option value="4">4 Hours</option>
                <option value="24">24 Hours</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full gradient-accent text-white" isLoading={saving}>
            <Megaphone size={16} /> Send Broadcast
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BroadcastsTab() {
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: BroadcastMessage[] }>('/broadcasts');
      setBroadcasts(((res as { data: BroadcastMessage[] }).data) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/broadcasts/${id}`);
      toast.success('Broadcast deleted');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setSendOpen(true)} className="gradient-accent text-white">
          <Megaphone size={16} /> Send Broadcast
        </Button>
      </div>

      {loading ? <Spinner /> : broadcasts.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
          <Megaphone size={36} className="mx-auto mb-3 opacity-30" />
          <p>No active broadcasts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                    <Megaphone size={16} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{b.title}</p>
                    <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">{b.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>By: {b.creator?.name ?? 'System'}</span>
                      {b.targetDepartment && <span>→ {b.targetDepartment}</span>}
                      {b.expiresAt && <span>Expires: {format(parseISO(b.expiresAt), 'MMM d, HH:mm')}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDelete(b.id)} className="text-danger hover:text-danger/80 mt-0.5 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SendBroadcastDialog open={sendOpen} onClose={() => setSendOpen(false)} onSuccess={load} />
    </div>
  );
}

// -------- Corrections Tab --------
function CorrectionsTab() {
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CorrectionRequest[] }>('/admin/corrections');
      setCorrections(((res as { data: CorrectionRequest[] }).data) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/admin/corrections/${id}`, { status: 'approved' });
      toast.success('Correction approved');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.patch(`/admin/corrections/${rejectTarget}`, { status: 'rejected', reviewNote: rejectNote });
      toast.success('Correction rejected');
      setRejectTarget(null); setRejectNote('');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const pending = corrections.filter((c) => c.status === 'PENDING');

  return (
    <div className="space-y-4">
      {loading ? <Spinner /> : pending.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
          <CheckCircle size={36} className="mx-auto mb-3 text-success opacity-50" />
          <p>No pending corrections</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                <th className="px-5 py-3 text-left">Employee</th>
                <th className="px-5 py-3 text-left">Original Clock-in</th>
                <th className="px-5 py-3 text-left">Requested Clock-in</th>
                <th className="px-5 py-3 text-left">Reason</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-2/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 gradient-accent rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {getInitials(c.user?.name ?? '?')}
                      </div>
                      <div>
                        <p className="text-white text-sm">{c.user?.name}</p>
                        <p className="text-gray-500 text-xs">{c.user?.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm font-mono">
                    {c.attendance?.clockIn ? formatTime(c.attendance.clockIn) : '--'}
                  </td>
                  <td className="px-5 py-3 text-accent text-sm font-mono">
                    {c.requestedClockIn ? formatTime(c.requestedClockIn) : '--'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm max-w-xs">
                    <span className="line-clamp-2">{c.reason}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="success" onClick={() => handleApprove(c.id)}>
                        <CheckCircle size={12} /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectTarget(c.id)}>
                        <XCircle size={12} /> Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectNote(''); }}>
        <DialogContent className="bg-surface border-border text-white max-w-sm">
          <DialogHeader><DialogTitle>Reject Correction</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason for rejection (optional)..." rows={3}
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
            <Button onClick={handleReject} variant="destructive" className="w-full">Confirm Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------- Main --------
export default function Admin() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Access Restricted</p>
          <p className="text-gray-600 text-sm mt-1">This page is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="text-gray-400 text-sm mt-1">System management and configuration</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="entry-points">Entry Points</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          <TabsTrigger value="corrections">Corrections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="entry-points"><EntryPointsTab /></TabsContent>
        <TabsContent value="broadcasts"><BroadcastsTab /></TabsContent>
        <TabsContent value="corrections"><CorrectionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
