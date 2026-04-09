import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Clock,
  KeyRound,
  MapPinned,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance';
import { bddApi } from '@/api/bdd';
import { useAuth } from '@/hooks/useAuth';
import FaceCapture from '@/components/FaceCapture';
import LivenessChallenge from '@/components/LivenessChallenge';
import QRScanner from '@/components/QRScanner';
import { Button } from '@/components/ui/button';
import type { AttendanceRecord, LivenessResponse, VerificationSession } from '@/types';
import { analyzeFaceImage, ensureFaceModels } from '@/lib/face-verification';
import { formatTime } from '@/lib/utils';

type ActiveTab = 'clock-in' | 'clock-out';
type ClockInStep = 'pin' | 'face' | 'liveness' | 'result';

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const workStart = new Date(time);
  workStart.setHours(9, 0, 0, 0);
  const minutesLate = Math.max(0, Math.floor((time.getTime() - workStart.getTime()) / 60000));

  return (
    <div className="text-center space-y-1">
      <div className="font-mono text-5xl font-bold tracking-tight text-accent">{format(time, 'HH:mm:ss')}</div>
      <div className="text-sm text-gray-400">{format(time, 'EEEE, MMMM d, yyyy')}</div>
      {minutesLate > 0 ? (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          <AlertCircle size={12} />
          You are {minutesLate} minute{minutesLate === 1 ? '' : 's'} past 9:00 AM
        </div>
      ) : null}
    </div>
  );
}

function StepPill({ index, label, active, complete }: { index: number; label: string; active: boolean; complete: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
        complete ? 'bg-success text-white' : active ? 'gradient-accent text-white' : 'bg-surface-2 text-gray-500'
      }`}>
        {complete ? <CheckCircle size={14} /> : index}
      </div>
      <span className={`text-sm ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

function determineStepIndex(step: ClockInStep) {
  if (step === 'pin') return 1;
  if (step === 'face') return 2;
  if (step === 'liveness') return 3;
  return 4;
}

export default function ClockIn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clock-in');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<ClockInStep>('pin');
  const [pin, setPin] = useState('');
  const [facePhoto, setFacePhoto] = useState('');
  const [faceAnalysis, setFaceAnalysis] = useState<{ descriptor: number[]; qualityScore: number; detectionScore: number; eyeAspectRatio: number; box: Record<string, unknown>; landmarks: Record<string, unknown> } | null>(null);
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [verificationResult, setVerificationResult] = useState<AttendanceRecord | null>(null);
  const [startSubmitting, setStartSubmitting] = useState(false);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [clockOutPhoto, setClockOutPhoto] = useState('');
  const [clockOutSubmitting, setClockOutSubmitting] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [mood, setMood] = useState('');
  const [location, setLocation] = useState<{ lat?: number; lng?: number; accuracy?: number; denied?: boolean }>({});
  const [showLegacyQr, setShowLegacyQr] = useState(false);
  const [legacyQrToken, setLegacyQrToken] = useState('');
  const [faceAnalyzing, setFaceAnalyzing] = useState(false);

  const currentStepIndex = determineStepIndex(step);
  const isLate = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);
    return now > start;
  }, []);

  const loadTodayStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getTodayStatus();
      const record = (res as { data: AttendanceRecord | null }).data;
      setTodayRecord(record);
      if (record) setActiveTab('clock-out');
    } catch {
      setTodayRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayStatus();
  }, [loadTodayStatus]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ denied: true });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          denied: false,
        });
      },
      () => {
        setLocation({ denied: true });
        toast.warning('Location access was denied. Verification can continue, but this attempt may be flagged for manager review.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      }
    );
  }, []);

  const handleStartVerification = async () => {
    if (!pin.trim()) {
      toast.error('Enter your employee PIN to continue.');
      return;
    }

    setStartSubmitting(true);
    try {
      const res = await attendanceApi.startVerification({
        pin,
        workMode: 'office',
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      });
      const session = (res as { data: VerificationSession }).data;
      setVerificationSession(session);

      if (!session.enrollmentReady) {
        toast.error('Face enrollment is required before office verification can continue.');
        navigate('/profile');
        return;
      }

      setStep('face');

      if (session.location.zoneType === 'staff_quarters_zone') {
        toast.warning('You are inside the staff-quarters zone. The system will still continue, but this attempt will likely be flagged.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start verification.');
    } finally {
      setStartSubmitting(false);
    }
  };

  const handleLivenessComplete = async (responses: LivenessResponse[]) => {
    if (!verificationSession) return;
    if (!facePhoto) {
      toast.error('Capture your face first.');
      return;
    }

    if (isLate && !lateReason.trim()) {
      toast.error('Please explain why you are late before continuing.');
      return;
    }

    setCompleteSubmitting(true);
    try {
      const res = await attendanceApi.completeVerification({
        sessionId: verificationSession.sessionId,
        facePhoto,
        faceDescriptor: faceAnalysis?.descriptor,
        faceCaptureMetrics: faceAnalysis ? {
          qualityScore: faceAnalysis.qualityScore,
          detectionScore: faceAnalysis.detectionScore,
          eyeAspectRatio: faceAnalysis.eyeAspectRatio,
          box: faceAnalysis.box,
          landmarks: faceAnalysis.landmarks,
        } : undefined,
        lateReason: isLate ? lateReason : undefined,
        mood: mood || undefined,
        livenessResponses: responses,
      });

      const record = (res as { data: AttendanceRecord }).data;
      setVerificationResult(record);
      setTodayRecord(record);
      setStep('result');

      const bddRes = await bddApi.getTodayBDD();
      if (!(bddRes as { data: unknown }).data) {
        setTimeout(() => navigate('/bdd'), 1800);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification could not be completed.');
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const handleContinueToLiveness = async () => {
    if (!facePhoto) {
      toast.error('Capture your face first.');
      return;
    }

    setFaceAnalyzing(true);
    try {
      await ensureFaceModels();
      const analysis = await analyzeFaceImage(facePhoto);
      if (!analysis) {
        toast.error('No usable face was detected. Please capture a clearer image in better lighting.');
        return;
      }

      setFaceAnalysis({
        descriptor: analysis.descriptor,
        qualityScore: analysis.qualityScore,
        detectionScore: analysis.detectionScore,
        eyeAspectRatio: analysis.eyeAspectRatio,
        box: analysis.box,
        landmarks: analysis.landmarks,
      });
      setStep('liveness');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Face analysis failed.');
    } finally {
      setFaceAnalyzing(false);
    }
  };

  const handleLegacyClockIn = async () => {
    if (!legacyQrToken.trim() || !facePhoto) {
      toast.error('Scan the fallback QR and capture your face to continue.');
      return;
    }

    setCompleteSubmitting(true);
    try {
      const res = await attendanceApi.clockIn({
        qrToken: legacyQrToken,
        facePhoto,
        lateReason: isLate ? lateReason : undefined,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      });
      const record = (res as { data: AttendanceRecord }).data;
      setVerificationResult(record);
      setTodayRecord(record);
      setStep('result');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Legacy QR fallback failed.');
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!clockOutPhoto) {
      toast.error('Capture your face to clock out.');
      return;
    }

    setClockOutSubmitting(true);
    try {
      const res = await attendanceApi.clockOut({
        facePhoto: clockOutPhoto,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      });
      const record = (res as { data: AttendanceRecord }).data;
      setTodayRecord(record);
      setVerificationResult(record);
      toast.success('Clocked out successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Clock out failed.');
    } finally {
      setClockOutSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Clock In / Out</h1>
        <p className="mt-1 text-sm text-gray-400">
          PIN, face verification, randomized liveness, and live location now drive office attendance. NFC and BLE remain for the final phase.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <LiveClock />
      </div>

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(['clock-in', 'clock-out'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition-all ${
              activeTab === tab ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white'
            } ${tab === 'clock-out' && !todayRecord ? 'cursor-not-allowed opacity-40' : ''}`}
            onClick={() => {
              if (tab === 'clock-out' && !todayRecord) return;
              setActiveTab(tab);
            }}
          >
            {tab === 'clock-in' ? 'Clock In' : 'Clock Out'}
          </button>
        ))}
      </div>

      {activeTab === 'clock-out' ? (
        !todayRecord ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-gray-400">
            Clock in first before trying to clock out.
          </div>
        ) : todayRecord.clockOut ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-4">
            <CheckCircle size={48} className="mx-auto text-success" />
            <div>
              <p className="text-xl font-semibold text-white">Clock-out completed</p>
              <p className="mt-1 text-sm text-gray-400">
                You clocked out at <span className="font-mono text-white">{todayRecord.clockOut ? formatTime(todayRecord.clockOut) : '--'}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
            <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-gray-200">
              You already clocked in today at <span className="font-mono text-white">{todayRecord.clockIn ? formatTime(todayRecord.clockIn) : '--'}</span>. Capture a live face image to clock out.
            </div>
            <FaceCapture
              instruction="Keep your head inside the frame, look straight ahead, and capture a clear face image."
              onCapture={(photo) => setClockOutPhoto(photo)}
            />
            <Button size="lg" className="w-full" isLoading={clockOutSubmitting} onClick={handleClockOut}>
              Confirm Clock Out
            </Button>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <StepPill index={1} label="PIN" active={currentStepIndex === 1} complete={currentStepIndex > 1} />
              <div className="hidden h-px flex-1 bg-border md:block" />
              <StepPill index={2} label="Face" active={currentStepIndex === 2} complete={currentStepIndex > 2} />
              <div className="hidden h-px flex-1 bg-border md:block" />
              <StepPill index={3} label="Liveness" active={currentStepIndex === 3} complete={currentStepIndex > 3} />
              <div className="hidden h-px flex-1 bg-border md:block" />
              <StepPill index={4} label="Decision" active={currentStepIndex === 4} complete={step === 'result'} />
            </div>
          </div>

          <div className="space-y-6 p-6">
            {!user?.hasPin || !user?.hasFaceEnrollment ? (
              <div className="rounded-xl border border-warning/20 bg-warning/10 p-5">
                <div className="flex items-start gap-3">
                  <TriangleAlert size={18} className="mt-0.5 text-warning" />
                  <div className="space-y-2">
                    <p className="font-semibold text-white">Complete your enrollment before office check-in</p>
                    <p className="text-sm text-gray-300">
                      {user?.hasPin ? 'Your PIN is ready, but your face enrollment still needs to be completed.' : 'You still need to set your employee PIN and complete face enrollment.'}
                    </p>
                    <Button variant="outline" onClick={() => navigate('/profile')}>
                      Open profile setup
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-2/80 p-4">
                <div className="flex items-center gap-2 text-accent">
                  <KeyRound size={16} />
                  <span className="text-sm font-medium">Knowledge factor</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">Employees enter their personal attendance PIN before any biometric or location step begins.</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/80 p-4">
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles size={16} />
                  <span className="text-sm font-medium">Identity & liveness</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">Face verification plus a randomized liveness challenge makes replay or shared-device abuse much harder.</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/80 p-4">
                <div className="flex items-center gap-2 text-accent">
                  <MapPinned size={16} />
                  <span className="text-sm font-medium">Zone-aware location</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">Location helps classify office zone, staff-quarter zone, weak accuracy, or suspicious distance before final approval.</p>
              </div>
            </div>

            {step === 'pin' ? (
              <div className="space-y-5">
                <div className="space-y-2 text-center">
                  <p className="text-lg font-semibold text-white">Start secure clock-in</p>
                  <p className="text-sm text-gray-400">Enter your employee PIN. The system will immediately open face verification and generate a randomized liveness challenge.</p>
                </div>

                <div className="rounded-2xl border border-border bg-surface-2 p-5 space-y-4">
                  <label className="block text-sm font-medium text-gray-300">Employee PIN</label>
                  <input
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    type="password"
                    placeholder="Enter 4 to 6 digits"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
                  />

                  <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-gray-300 space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={15} className="mt-0.5 text-success" />
                      <span>Known-device history and PIN success feed the risk engine before any biometric decision is made.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPinned size={15} className="mt-0.5 text-accent" />
                      <span>
                        Location status:{' '}
                        <span className="font-medium text-white">
                          {location.denied ? 'Denied by device' : location.lat ? 'Captured live' : 'Pending'}
                        </span>
                      </span>
                    </div>
                    {verificationSession?.location.zoneName ? (
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={15} className="mt-0.5 text-warning" />
                        <span>Current zone: {verificationSession.location.zoneName}</span>
                      </div>
                    ) : null}
                  </div>

                  {isLate ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">Reason for being late</label>
                      <textarea
                        rows={3}
                        value={lateReason}
                        onChange={(event) => setLateReason(event.target.value)}
                        placeholder="Explain what caused the delay today"
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Mood for the day</label>
                    <input
                      value={mood}
                      onChange={(event) => setMood(event.target.value)}
                      placeholder="Focused, optimistic, under pressure..."
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-white placeholder:text-gray-500 focus:border-accent focus:outline-none"
                    />
                  </div>

                  <Button size="lg" className="w-full" isLoading={startSubmitting} onClick={handleStartVerification}>
                    Start verification
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-4">
                  <button
                    type="button"
                    className="text-sm font-medium text-accent"
                    onClick={() => setShowLegacyQr((current) => !current)}
                  >
                    {showLegacyQr ? 'Hide' : 'Use'} legacy QR fallback instead
                  </button>

                  {showLegacyQr ? (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      <p className="text-sm text-gray-400">
                        QR is now secondary. Use this only if your team still needs the older entrance-token flow while the new PIN-led verification is being rolled out.
                      </p>
                      <QRScanner
                        onScan={(token) => setLegacyQrToken(token)}
                        onError={(message) => toast.error(message)}
                      />
                      {legacyQrToken ? (
                        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                          QR fallback token captured. Continue with face capture, then submit the legacy flow.
                        </div>
                      ) : null}
                      <FaceCapture
                        instruction="Capture a clean face image before using the legacy QR fallback."
                        onCapture={(photo) => {
                          setFacePhoto(photo);
                          setFaceAnalysis(null);
                        }}
                      />
                      <Button size="lg" variant="outline" className="w-full" isLoading={completeSubmitting} onClick={handleLegacyClockIn}>
                        Complete legacy QR clock-in
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 'face' ? (
              <div className="space-y-5">
                <div className="space-y-2 text-center">
                  <p className="text-lg font-semibold text-white">Face verification</p>
                  <p className="text-sm text-gray-400">
                    Keep your head inside the frame, keep your usual accessories on if you normally wear them, and capture a clear image.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-surface-2/80 p-5">
                  <FaceCapture
                    instruction="Center your face inside the guide, hold still, and capture a clear image."
                    onCapture={(photo) => {
                      setFacePhoto(photo);
                      setFaceAnalysis(null);
                    }}
                  />
                </div>

                {facePhoto ? (
                  <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-gray-200">
                    Face image captured. The system will extract a real facial descriptor before moving to the liveness stage.
                  </div>
                ) : null}

                <Button size="lg" className="w-full" disabled={!facePhoto} isLoading={faceAnalyzing} onClick={handleContinueToLiveness}>
                  Continue to liveness
                </Button>
              </div>
            ) : null}

            {step === 'liveness' && verificationSession ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-surface-2/80 p-5 space-y-3">
                  <p className="text-sm font-medium text-white">Verification session status</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Zone</p>
                      <p className="mt-2 text-sm font-medium text-white">{verificationSession.location.zoneName || verificationSession.location.zoneType || 'General office radius'}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Risk score</p>
                      <p className="mt-2 text-sm font-medium text-white">{verificationSession.risk.score}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Distance</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {verificationSession.location.distanceFromOffice !== null && verificationSession.location.distanceFromOffice !== undefined
                          ? `${Math.round(verificationSession.location.distanceFromOffice)}m`
                          : 'Unavailable'}
                      </p>
                    </div>
                  </div>

                  {verificationSession.risk.reasons.length ? (
                    <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-gray-200">
                      <p className="font-medium text-white">Risk signals already detected</p>
                      <ul className="mt-2 space-y-1 text-sm text-gray-300">
                        {verificationSession.risk.reasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <LivenessChallenge
                  prompts={verificationSession.prompts}
                  onComplete={handleLivenessComplete}
                />

                {completeSubmitting ? (
                  <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-gray-400">
                    Finalizing attendance verification...
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 'result' && verificationResult ? (
              <div className="space-y-5">
                <div className={`rounded-2xl border p-6 text-center ${
                  verificationResult.reviewDecision === 'blocked'
                    ? 'border-danger/30 bg-danger/10'
                    : verificationResult.reviewDecision === 'flagged'
                      ? 'border-warning/30 bg-warning/10'
                      : 'border-success/30 bg-success/10'
                }`}>
                  {verificationResult.reviewDecision === 'blocked' ? (
                    <ShieldAlert size={44} className="mx-auto text-danger" />
                  ) : verificationResult.reviewDecision === 'flagged' ? (
                    <TriangleAlert size={44} className="mx-auto text-warning" />
                  ) : (
                    <ShieldCheck size={44} className="mx-auto text-success" />
                  )}

                  <p className="mt-4 text-xl font-semibold text-white">
                    {verificationResult.reviewDecision === 'blocked'
                      ? 'Clock-in blocked for manager review'
                      : verificationResult.reviewDecision === 'flagged'
                        ? 'Clock-in recorded and flagged'
                        : 'Clock-in approved'}
                  </p>
                  <p className="mt-2 text-sm text-gray-200">
                    {verificationResult.clockIn ? `Recorded at ${formatTime(verificationResult.clockIn)}` : 'Attendance record created successfully.'}
                  </p>
                </div>

                {verificationResult.verification?.reasons?.length ? (
                  <div className="rounded-xl border border-border bg-surface-2/80 p-5">
                    <p className="text-sm font-medium text-white">Why this decision happened</p>
                    <ul className="mt-3 space-y-2 text-sm text-gray-300">
                      {verificationResult.verification.reasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
                  <Button variant="outline" onClick={() => navigate('/bdd')}>
                    Open daily pulse
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
