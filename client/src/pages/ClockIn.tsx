import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, QrCode, Camera, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance';
import { qrApi } from '@/api/qr';
import { bddApi } from '@/api/bdd';
import QRScanner from '@/components/QRScanner';
import FaceCapture from '@/components/FaceCapture';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AttendanceRecord, EntryPoint } from '@/types';
import { formatTime } from '@/lib/utils';

type ClockInStep = 'qr' | 'face' | 'done';
type ActiveTab = 'clock-in' | 'clock-out';

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = time.getHours();
  const startHour = 9;
  const isLate = hour >= startHour;
  const minutesLate = Math.max(0, (hour - startHour) * 60 + time.getMinutes());

  return (
    <div className="text-center space-y-1">
      <div className="text-5xl font-bold text-accent font-mono tracking-tight">
        {format(time, 'HH:mm:ss')}
      </div>
      <div className="text-gray-400 text-sm">{format(time, 'EEEE, MMMM d, yyyy')}</div>
      {isLate && minutesLate > 0 && (
        <div className="inline-flex items-center gap-1.5 bg-warning/10 border border-warning/30 rounded-full px-3 py-1 text-warning text-xs font-medium">
          <AlertCircle size={12} />
          You are {minutesLate} minute{minutesLate !== 1 ? 's' : ''} past 9:00 AM
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, current }: { step: number; label: string; current: number }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
      ${done ? 'bg-success text-white' : active ? 'gradient-accent text-white' : 'bg-surface-2 text-gray-500'}`}>
      {done ? <CheckCircle size={14} /> : step}
    </div>
  );
}

export default function ClockIn() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clock-in');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null | undefined>(undefined);
  const [step, setStep] = useState<ClockInStep>('qr');
  const [qrToken, setQrToken] = useState('');
  const [entryPoint, setEntryPoint] = useState<EntryPoint | null>(null);
  const [facePhoto, setFacePhoto] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clockOutSubmitting, setClockOutSubmitting] = useState(false);
  const [clockOutPhoto, setClockOutPhoto] = useState('');
  const [successRecord, setSuccessRecord] = useState<AttendanceRecord | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  const isLate = new Date().getHours() >= 9;
  useEffect(() => {
    attendanceApi.getTodayStatus()
      .then((res) => {
        const rec = (res as { data: AttendanceRecord | null }).data;
        setTodayRecord(rec);
        if (rec) setActiveTab('clock-out');
      })
      .catch(() => setTodayRecord(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        toast.warning('Location access was denied. QR and face verification will still continue.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      }
    );
  }, []);

  const handleQRScan = useCallback(async (token: string) => {
    try {
      const res = await qrApi.validateToken(token);
      const validated = (res as { data: { valid: boolean; entryPointId: string; entryPoint: EntryPoint } }).data;
      if (!validated.valid) { toast.error('Invalid or expired QR code'); return; }
      setQrToken(token);
      setEntryPoint(validated.entryPoint);
      setStep('face');
    } catch {
      toast.error('Failed to validate QR code');
    }
  }, []);

  const handleFaceCapture = useCallback((photo: string) => {
    setFacePhoto(photo);
  }, []);

  const handleClockIn = async () => {
    if (!facePhoto) { toast.error('Please capture your face photo'); return; }
    if (isLate && !lateReason.trim()) { toast.error('Please provide a reason for being late'); return; }
    setSubmitting(true);
    try {
      const res = await attendanceApi.clockIn({
        qrToken,
        facePhoto,
        lateReason: isLate ? lateReason : undefined,
        lat: location?.lat,
        lng: location?.lng,
        accuracy: location?.accuracy,
      });
      const record = (res as { data: AttendanceRecord }).data;
      setSuccessRecord(record);
      setTodayRecord(record);

      // Check BDD
      const bddRes = await bddApi.getTodayBDD();
      const bdd = (bddRes as { data: unknown }).data;
      if (!bdd) {
        setStep('done');
        setTimeout(() => navigate('/bdd'), 1500);
      } else {
        setStep('done');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Clock in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!clockOutPhoto) { toast.error('Please capture your face photo'); return; }
    setClockOutSubmitting(true);
    try {
      const res = await attendanceApi.clockOut(location ? {
        facePhoto: clockOutPhoto,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      } : { facePhoto: clockOutPhoto });
      const record = (res as { data: AttendanceRecord }).data;
      setSuccessRecord(record);
      setTodayRecord(record);
      toast.success('Clocked out successfully!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Clock out failed');
    } finally {
      setClockOutSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <p className="text-gray-400 text-sm mt-1">Clock in or out for the day</p>
      </div>

      {/* Live clock */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <LiveClock />
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-2 rounded-xl p-1 gap-1">
        {(['clock-in', 'clock-out'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            disabled={tab === 'clock-out' && !todayRecord}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all capitalize
              ${activeTab === tab ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white disabled:opacity-40'}`}
          >
            {tab === 'clock-in' ? 'Clock In' : 'Clock Out'}
          </button>
        ))}
      </div>

      {/* Already clocked out */}
      {activeTab === 'clock-out' && todayRecord?.clockOut && successRecord ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-4">
          <CheckCircle size={48} className="text-success mx-auto" />
          <div>
            <p className="text-white font-semibold text-lg">Clocked Out</p>
            <p className="text-gray-400 text-sm mt-1">
              You clocked out at <span className="text-white font-mono">{formatTime(successRecord.clockOut!)}</span>
            </p>
            {successRecord.workHours && (
              <p className="text-accent font-bold text-2xl mt-2">{successRecord.workHours.toFixed(1)} hours worked</p>
            )}
          </div>
        </div>
      ) : activeTab === 'clock-out' && todayRecord ? (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/30 rounded-lg">
            <CheckCircle size={16} className="text-success" />
            <div>
              <p className="text-white text-sm">Clocked in at <span className="font-mono font-bold">{formatTime(todayRecord.clockIn!)}</span></p>
              <p className="text-gray-400 text-xs mt-0.5">Scan face to clock out</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-white font-medium text-center">Face Verification</p>
            <FaceCapture
              instruction="Look at the camera to clock out"
              onCapture={(photo) => setClockOutPhoto(photo)}
            />
          </div>

          {clockOutPhoto && (
            <Button
              className="w-full gradient-accent text-white"
              size="lg"
              isLoading={clockOutSubmitting}
              onClick={handleClockOut}
            >
              Confirm Clock Out
            </Button>
          )}
        </div>
      ) : activeTab === 'clock-in' && step === 'done' ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <div>
            <p className="text-white font-semibold text-xl">Clocked In!</p>
            <p className="text-gray-400 mt-1">
              At <span className="text-success font-mono font-bold">{successRecord?.clockIn ? formatTime(successRecord.clockIn) : '--:--'}</span>
            </p>
            {successRecord?.status === 'LATE' && <Badge variant="warning" className="mt-2">Late</Badge>}
          </div>
          <Button onClick={() => navigate('/dashboard')} className="gradient-accent text-white">
            Go to Dashboard <ArrowRight size={16} />
          </Button>
        </div>
      ) : activeTab === 'clock-in' ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* Step indicators */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StepIndicator step={1} label="Scan QR" current={step === 'qr' ? 1 : step === 'face' ? 2 : 3} />
                <span className={`text-sm ${step === 'qr' ? 'text-white' : 'text-gray-500'}`}>Scan QR</span>
              </div>
              <div className="flex-1 h-px bg-border" />
              <div className="flex items-center gap-2">
                <StepIndicator step={2} label="Face" current={step === 'qr' ? 1 : step === 'face' ? 2 : 3} />
                <span className={`text-sm ${step === 'face' ? 'text-white' : 'text-gray-500'}`}>Verify Face</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {step === 'qr' && (
              <>
                <div className="text-center space-y-1">
                  <QrCode size={24} className="text-accent mx-auto" />
                  <p className="text-white font-medium">Scan the QR code at the entrance</p>
                  <p className="text-gray-500 text-sm">Hold your camera over the QR code displayed at the door</p>
                </div>
                <QRScanner onScan={handleQRScan} onError={(e) => toast.error(e)} />
                {isLate && (
                  <div className="space-y-2">
                    <label className="text-gray-300 text-sm font-medium">
                      Reason for being late <span className="text-danger">*</span>
                    </label>
                    <textarea
                      value={lateReason}
                      onChange={(e) => setLateReason(e.target.value)}
                      placeholder="Please explain why you are late..."
                      rows={3}
                      className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </>
            )}

            {step === 'face' && (
              <>
                <div className="text-center space-y-1">
                  {entryPoint && (
                    <div className="inline-flex items-center gap-2 bg-success/10 border border-success/30 rounded-full px-3 py-1 text-success text-xs mb-3">
                      <CheckCircle size={12} /> {entryPoint.name}
                    </div>
                  )}
                  <Camera size={24} className="text-accent mx-auto" />
                  <p className="text-white font-medium">Verify your identity</p>
                  <p className="text-gray-500 text-sm">Please blink slowly as you look at the camera</p>
                </div>
                <FaceCapture
                  instruction="Look directly at the camera and blink slowly"
                  onCapture={handleFaceCapture}
                />
                {facePhoto && (
                  <Button
                    className="w-full gradient-accent text-white"
                    size="lg"
                    isLoading={submitting}
                    onClick={handleClockIn}
                  >
                    {submitting ? 'Verifying...' : 'Confirm Clock In'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
