import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock3, MapPinned, ShieldAlert, Sparkles, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { attendanceApi } from '@/api/attendance';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AdminSettings, AttendanceRecord, OfficeZone, ReviewQueueItem } from '@/types';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

function OverviewTab() {
  const [dashboard, setDashboard] = useState<{
    todayStats: { present: number; late: number; absent: number; onLeave: number };
    liveFeed: AttendanceRecord[];
    pendingLeaves: number;
    pendingExpenses: number;
    pendingCorrections: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((res) => setDashboard((res as { data: typeof dashboard }).data))
      .catch(() => toast.error('Failed to load admin dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!dashboard) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Present', value: dashboard.todayStats.present, color: 'text-success' },
          { label: 'Late', value: dashboard.todayStats.late, color: 'text-warning' },
          { label: 'Absent', value: dashboard.todayStats.absent, color: 'text-danger' },
          { label: 'On Leave', value: dashboard.todayStats.onLeave, color: 'text-blue-400' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-5">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="mt-1 text-sm text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-white">Pending leaves</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">{dashboard.pendingLeaves}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-white">Pending expenses</p>
          <p className="mt-2 text-3xl font-bold text-warning">{dashboard.pendingExpenses}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-white">Pending corrections</p>
          <p className="mt-2 text-3xl font-bold text-danger">{dashboard.pendingCorrections}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold text-white">Live attendance feed</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.2em] text-gray-500">
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Clock in</th>
                <th className="px-5 py-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.liveFeed.map((record) => (
                <tr key={record.id} className="border-b border-border/50">
                  <td className="px-5 py-3 text-sm text-white">{record.user?.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{record.user?.department}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{record.clockIn ? format(new Date(record.clockIn), 'HH:mm:ss') : '--'}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      record.reviewDecision === 'flagged'
                        ? 'bg-warning/10 text-warning'
                        : record.reviewDecision === 'blocked'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-success/10 text-success'
                    }`}>
                      {record.reviewDecision || 'approved'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get('/admin/settings');
    setSettings((res as { data: AdminSettings }).data);
  }, []);

  useEffect(() => {
    load().catch(() => toast.error('Failed to load settings.'));
  }, [load]);

  if (!settings) return <Spinner />;

  const office = settings.officeLocations[0];

  const save = async () => {
    if (!office) {
      toast.error('At least one office location is required.');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/admin/settings', {
        workStartTime: settings.appConfig.workStartTime,
        gracePeriodMinutes: settings.appConfig.gracePeriodMinutes,
        requireLocation: settings.appConfig.requireLocation,
        requireFaceCapture: settings.appConfig.requireFaceCapture,
        requireLiveness: settings.appConfig.requireLiveness,
        requireEmployeePin: settings.appConfig.requireEmployeePin,
        office,
      });
      toast.success('Settings updated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-white">Attendance policy</h3>
          <p className="mt-1 text-sm text-gray-400">Set the baseline rules used by PIN, liveness, location, and review logic.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Work start time</Label>
            <Input
              value={settings.appConfig.workStartTime}
              onChange={(event) => setSettings((current) => current ? {
                ...current,
                appConfig: { ...current.appConfig, workStartTime: event.target.value },
              } : current)}
              className="bg-surface-2 border-border text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Grace period (minutes)</Label>
            <Input
              type="number"
              value={settings.appConfig.gracePeriodMinutes}
              onChange={(event) => setSettings((current) => current ? {
                ...current,
                appConfig: { ...current.appConfig, gracePeriodMinutes: Number(event.target.value) || 0 },
              } : current)}
              className="bg-surface-2 border-border text-white"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            { key: 'requireEmployeePin', label: 'Require employee PIN' },
            { key: 'requireFaceCapture', label: 'Require face capture' },
            { key: 'requireLiveness', label: 'Require liveness' },
            { key: 'requireLocation', label: 'Require live location' },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm text-gray-300">
              {item.label}
              <input
                type="checkbox"
                checked={Boolean(settings.appConfig[item.key as keyof AdminSettings['appConfig']])}
                onChange={(event) => setSettings((current) => current ? {
                  ...current,
                  appConfig: {
                    ...current.appConfig,
                    [item.key]: event.target.checked,
                  },
                } : current)}
              />
            </label>
          ))}
        </div>
      </div>

      {office ? (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-white">Office coordinates</h3>
            <p className="mt-1 text-sm text-gray-400">These are the official coordinates your backend uses for zone comparison and distance scoring.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-gray-300">Office name</Label>
              <Input
                value={office.name}
                onChange={(event) => setSettings((current) => current ? {
                  ...current,
                  officeLocations: [{ ...current.officeLocations[0], name: event.target.value }],
                } : current)}
                className="bg-surface-2 border-border text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Office address</Label>
              <Input
                value={office.address}
                onChange={(event) => setSettings((current) => current ? {
                  ...current,
                  officeLocations: [{ ...current.officeLocations[0], address: event.target.value }],
                } : current)}
                className="bg-surface-2 border-border text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Latitude</Label>
              <Input
                type="number"
                value={office.latitude}
                onChange={(event) => setSettings((current) => current ? {
                  ...current,
                  officeLocations: [{ ...current.officeLocations[0], latitude: Number(event.target.value) || 0 }],
                } : current)}
                className="bg-surface-2 border-border text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Longitude</Label>
              <Input
                type="number"
                value={office.longitude}
                onChange={(event) => setSettings((current) => current ? {
                  ...current,
                  officeLocations: [{ ...current.officeLocations[0], longitude: Number(event.target.value) || 0 }],
                } : current)}
                className="bg-surface-2 border-border text-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-300">Default office radius (meters)</Label>
              <Input
                type="number"
                value={office.radiusMeters}
                onChange={(event) => setSettings((current) => current ? {
                  ...current,
                  officeLocations: [{ ...current.officeLocations[0], radiusMeters: Number(event.target.value) || 0 }],
                } : current)}
                className="bg-surface-2 border-border text-white"
              />
            </div>
          </div>
        </div>
      ) : null}

      <Button onClick={save} isLoading={saving}>
        Save settings
      </Button>
    </div>
  );
}

function ZonesTab() {
  const [zones, setZones] = useState<OfficeZone[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    officeLocationId: '',
    name: '',
    type: 'work_zone' as OfficeZone['type'],
    centerLat: '',
    centerLng: '',
    radiusMeters: '',
    riskWeight: '20',
  });

  const load = useCallback(async () => {
    const [zonesRes, settingsRes] = await Promise.all([
      attendanceApi.getZones(),
      api.get('/admin/settings'),
    ]);
    setZones((zonesRes as { data: OfficeZone[] }).data || []);
    const settingsPayload = (settingsRes as { data: AdminSettings }).data;
    setSettings(settingsPayload);
    if (!form.officeLocationId && settingsPayload.officeLocations[0]) {
      setForm((current) => ({ ...current, officeLocationId: settingsPayload.officeLocations[0].id }));
    }
  }, [form.officeLocationId]);

  useEffect(() => {
    load().catch(() => toast.error('Failed to load office zones.'));
  }, [load]);

  const createZone = async () => {
    if (!form.officeLocationId || !form.name.trim()) {
      toast.error('Office and zone name are required.');
      return;
    }

    setSaving(true);
    try {
      await attendanceApi.createZone({
        officeLocationId: form.officeLocationId,
        name: form.name.trim(),
        type: form.type,
        centerLat: Number(form.centerLat),
        centerLng: Number(form.centerLng),
        radiusMeters: Number(form.radiusMeters),
        riskWeight: Number(form.riskWeight) || 0,
        allowedForAttendance: form.type !== 'restricted_zone',
      });
      toast.success('Zone created.');
      setForm((current) => ({ ...current, name: '', centerLat: '', centerLng: '', radiusMeters: '', riskWeight: '20' }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create zone.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-white">Create verification zones</h3>
          <p className="mt-1 text-sm text-gray-400">Map work zones, entry zones, and staff quarters so nearby staff housing is not treated as the same thing as the work building.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Office</Label>
            <select
              value={form.officeLocationId}
              onChange={(event) => setForm((current) => ({ ...current, officeLocationId: event.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
            >
              {settings.officeLocations.map((office) => (
                <option key={office.id} value={office.id}>{office.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Zone type</Label>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as OfficeZone['type'] }))}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
            >
              <option value="entry_zone">Entry zone</option>
              <option value="work_zone">Work zone</option>
              <option value="staff_quarters_zone">Staff quarters zone</option>
              <option value="admin_zone">Admin zone</option>
              <option value="warehouse_zone">Warehouse zone</option>
              <option value="restricted_zone">Restricted zone</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-300">Zone name</Label>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Center latitude</Label>
            <Input value={form.centerLat} onChange={(event) => setForm((current) => ({ ...current, centerLat: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Center longitude</Label>
            <Input value={form.centerLng} onChange={(event) => setForm((current) => ({ ...current, centerLng: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Radius (meters)</Label>
            <Input value={form.radiusMeters} onChange={(event) => setForm((current) => ({ ...current, radiusMeters: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Risk weight</Label>
            <Input value={form.riskWeight} onChange={(event) => setForm((current) => ({ ...current, riskWeight: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
        </div>
        <Button onClick={createZone} isLoading={saving}>Create zone</Button>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold text-white">Current zones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.2em] text-gray-500">
                <th className="px-5 py-3">Zone</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Radius</th>
                <th className="px-5 py-3">Risk weight</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-border/50">
                  <td className="px-5 py-3 text-sm text-white">{zone.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{zone.type}</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{zone.radiusMeters}m</td>
                  <td className="px-5 py-3 text-sm text-gray-300">{zone.riskWeight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReviewQueueTab() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getReviewQueue();
      setQueue((res as { data: ReviewQueueItem[] }).data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => toast.error('Failed to load review queue.'));
  }, [load]);

  const update = async (id: string, status: 'approved' | 'rejected' | 'escalated') => {
    setUpdatingId(id);
    try {
      await attendanceApi.updateReviewQueue(id, { status });
      toast.success(`Review item ${status}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update review queue.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {queue.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-gray-500">
          No suspicious events need review right now.
        </div>
      ) : queue.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-warning" />
                <p className="font-semibold text-white">{item.user?.name || item.userId}</p>
              </div>
              <p className="text-sm text-gray-400">{item.recommendation}</p>
              <p className="text-xs text-gray-500">{item.user?.department || 'Unknown department'} • Logged {format(new Date(item.createdAt), 'MMM d, HH:mm')}</p>
            </div>
            <div className="rounded-full bg-warning/10 px-3 py-1 text-sm font-medium text-warning">
              Risk {item.riskScore}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
            <div className="rounded-xl border border-border bg-surface-2/70 p-4">
              <p className="text-sm font-medium text-white">Risk reasons</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-300">
                {item.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-surface-2/70 p-4 space-y-3">
              <p className="text-sm font-medium text-white">AI summary</p>
              <p className="text-sm text-gray-300">{item.attendanceVerification?.aiSummary || 'Rule-based risk summary only for now.'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" isLoading={updatingId === item.id} onClick={() => update(item.id, 'approved')}>
              <CheckCircle size={14} /> Approve
            </Button>
            <Button size="sm" variant="warning" isLoading={updatingId === item.id} onClick={() => update(item.id, 'escalated')}>
              <AlertTriangle size={14} /> Escalate
            </Button>
            <Button size="sm" variant="destructive" isLoading={updatingId === item.id} onClick={() => update(item.id, 'rejected')}>
              <ShieldAlert size={14} /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssistedClockInTab() {
  const [users, setUsers] = useState<Array<{ id: string; name: string; employeeId?: string; department?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    reasonCode: 'device_failure',
    note: '',
    workMode: 'office' as 'office' | 'wfh' | 'field' | 'client_site',
    lat: '',
    lng: '',
    accuracy: '',
  });

  useEffect(() => {
    api.get('/employees')
      .then((res) => {
        const rows = ((res as { data: Array<{ id: string; name: string; employeeId?: string; department?: string }> }).data) || [];
        setUsers(rows);
        if (!form.employeeId && rows[0]) {
          setForm((current) => ({ ...current, employeeId: rows[0].id }));
        }
      })
      .catch(() => toast.error('Failed to load employees for assisted clock-in.'))
      .finally(() => setLoading(false));
  }, [form.employeeId]);

  const submit = async () => {
    if (!form.employeeId) {
      toast.error('Choose an employee first.');
      return;
    }

    setSaving(true);
    try {
      await attendanceApi.assistedClockIn({
        employeeId: form.employeeId,
        reasonCode: form.reasonCode,
        note: form.note || undefined,
        workMode: form.workMode,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        accuracy: form.accuracy ? Number(form.accuracy) : undefined,
      });
      toast.success('Admin-assisted clock-in created.');
      setForm((current) => ({ ...current, note: '', lat: '', lng: '', accuracy: '' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create assisted clock-in.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-white">Admin-assisted fallback</h3>
          <p className="mt-1 text-sm text-gray-400">Use this only when the full PIN, face, liveness, and location flow cannot complete. Every assisted record is flagged and auditable.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Employee</Label>
            <select value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none">
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} {user.department ? `(${user.department})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Reason code</Label>
            <select value={form.reasonCode} onChange={(event) => setForm((current) => ({ ...current, reasonCode: event.target.value }))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none">
              <option value="device_failure">Device failure</option>
              <option value="camera_unavailable">Camera unavailable</option>
              <option value="network_issue">Network issue</option>
              <option value="emergency_override">Emergency override</option>
              <option value="onboarding_day">Onboarding day</option>
              <option value="supervisor_authorized">Supervisor authorized</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Work mode</Label>
            <select value={form.workMode} onChange={(event) => setForm((current) => ({ ...current, workMode: event.target.value as typeof current.workMode }))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none">
              <option value="office">Office</option>
              <option value="wfh">WFH</option>
              <option value="field">Field</option>
              <option value="client_site">Client site</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Note</Label>
            <Input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Latitude (optional)</Label>
            <Input value={form.lat} onChange={(event) => setForm((current) => ({ ...current, lat: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Longitude (optional)</Label>
            <Input value={form.lng} onChange={(event) => setForm((current) => ({ ...current, lng: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-300">Accuracy meters (optional)</Label>
            <Input value={form.accuracy} onChange={(event) => setForm((current) => ({ ...current, accuracy: event.target.value }))} className="bg-surface-2 border-border text-white" />
          </div>
        </div>
        <Button onClick={submit} isLoading={saving}>
          <UserCog size={14} />
          Create assisted clock-in
        </Button>
      </div>

      <div className="rounded-xl border border-warning/20 bg-warning/10 p-5">
        <div className="flex items-start gap-3">
          <Clock3 size={18} className="mt-0.5 text-warning" />
          <div className="space-y-2 text-sm text-gray-200">
            <p className="font-semibold text-white">Use assisted clock-in sparingly</p>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Every assisted record is automatically flagged for review.</li>
              <li>• The review queue stores the override reason, note, admin ID, and risk context.</li>
              <li>• Override frequency should be monitored later for payroll and abuse detection.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-gray-500">Access restricted</p>
          <p className="mt-1 text-sm text-gray-600">Only admins can manage zones, overrides, and the suspicious review queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin control center</h1>
        <p className="mt-1 text-sm text-gray-400">Manage zones, security thresholds, suspicious reviews, and admin-assisted attendance while the system transitions away from QR.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-accent"><MapPinned size={16} /><span className="text-sm font-medium">Zone intelligence</span></div>
          <p className="mt-2 text-sm text-gray-400">Map entry zones, work zones, and staff quarters so location is interpreted correctly.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-accent"><ShieldAlert size={16} /><span className="text-sm font-medium">Review automation</span></div>
          <p className="mt-2 text-sm text-gray-400">Flagged events surface with rule-based and AI-style summaries to help managers decide quickly.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-accent"><Sparkles size={16} /><span className="text-sm font-medium">Resilient fallback</span></div>
          <p className="mt-2 text-sm text-gray-400">Admin-assisted clock-in keeps operations moving without silently weakening the audit trail.</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
          <TabsTrigger value="assisted">Assisted Clock-In</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="zones"><ZonesTab /></TabsContent>
        <TabsContent value="review-queue"><ReviewQueueTab /></TabsContent>
        <TabsContent value="assisted"><AssistedClockInTab /></TabsContent>
      </Tabs>
    </div>
  );
}
