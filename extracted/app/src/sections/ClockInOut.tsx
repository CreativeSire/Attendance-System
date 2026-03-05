import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  MapPin, 
  QrCode,
  Scan,
  CheckCircle2,
  Loader2,
  Navigation,
  LocateFixed,
  Camera,
  X,
  ShieldCheck,
  AlertTriangle,
  Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Html5Qrcode } from 'html5-qrcode';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import type { AttendanceRecord } from '@/types';
import type { AttendanceHook } from '@/hooks/useAttendance';
import type { LocationHook } from '@/hooks/useLocation';

interface ClockInOutProps {
  attendance: AttendanceHook;
  location: LocationHook;
  todayRecord: AttendanceRecord | undefined;
  verifyQRCode: (code: string) => boolean;
}

export function ClockInOut({ attendance, location, todayRecord, verifyQRCode }: ClockInOutProps) {
  const { user, updateMasterPhoto } = useAuth();
  const { toast } = useToast();
  
  const [activeMethod, setActiveMethod] = useState<'gps' | 'qr'>('gps');
  const [step, setStep] = useState<'idle' | 'scanning-qr' | 'capturing-face' | 'processing'>('idle');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  
  // Task 1 & 2: Biometrics & Liveness
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [voiceChallengeCode, setVoiceChallengeCode] = useState<string>("");
  const [latenessReason, setLatenessReason] = useState<string>("");
  const [isNegotiatingLate, setIsNegotiatingLate] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);

  const isClockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;
  const isClockedOut = !!todayRecord?.clockOut;

  // Load Face API Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models') // Mood Detection
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Face API loading failed:", err);
      }
    };
    loadModels();
  }, []);

  // Task 2: Voice Challenge (Random Code)
  const generateVoiceChallenge = useCallback(() => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setVoiceChallengeCode(code.split("").join("-"));
  }, []);

  // Auto-detect face loop
  useEffect(() => {
    let animationFrameId: number;
    let detectionThrottle = 0;
    
    const detectFaceLoop = async () => {
      if (step === 'capturing-face' && modelsLoaded && webcamRef.current) {
        detectionThrottle++;
        if (detectionThrottle % 5 === 0) { // Scan every 5 frames for performance
          const video = webcamRef.current.video;
          if (video && video.readyState === 4) {
            try {
              const detection = await faceapi.detectSingleFace(
                video,
                new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
              ).withFaceExpressions();
              
              if (detection) {
                setFaceDetected(true);
                // Extract strongest expression
                const expressions = detection.expressions;
                const topMood = Object.keys(expressions).reduce((a, b) => 
                  (expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b)
                );
                setDetectedMood(topMood);

                // If face is stable, show voice challenge
                if (step === 'capturing-face' && !voiceChallengeCode) {
                  generateVoiceChallenge();
                }
              } else {
                setFaceDetected(false);
              }
            } catch (err) {}
          }
        }
      }
      animationFrameId = requestAnimationFrame(detectFaceLoop);
    };

    if (step === 'capturing-face') {
      detectFaceLoop();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [step, modelsLoaded, voiceChallengeCode, generateVoiceChallenge]);

  // Turn base64 to HTMLImageElement for FaceAPI
  const base64ToImage = (base64: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = base64;
    });
  };

  const processBiometricClockAction = async (finalReason?: string) => {
    if (!user || !userLocation) return;
    
    const photo = webcamRef.current?.getScreenshot();
    if (!photo) {
      toast('Failed to capture photo.', 'error');
      return;
    }

    setStep('processing');

    try {
      if (modelsLoaded) {
        const img = await base64ToImage(photo);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        
        if (!detection) {
          throw new Error("No face detected. Please keep your face in the oval.");
        }

        if (user.masterPhoto) {
          const masterImg = await base64ToImage(user.masterPhoto);
          const masterDetection = await faceapi.detectSingleFace(masterImg).withFaceLandmarks().withFaceDescriptor();
          
          if (masterDetection) {
            const distance = faceapi.euclideanDistance(detection.descriptor, masterDetection.descriptor);
            if (distance > 0.5) {
              // Task: Auto-Retry if Face Match fails
              toast("Face match low confidence. Retrying in 2 seconds...", "warning");
              setTimeout(() => setStep('capturing-face'), 2000);
              return;
            }
          }
        } else {
          updateMasterPhoto(user.id, photo);
          toast("Face Profile registered.", "success");
        }
      }

      // Check if user is late
      const now = new Date();
      const timeStr = fmtTime(now.toISOString());
      const [currentHour, currentMinute] = timeStr.split(':').map(Number);
      const isLate = (currentHour * 60 + currentMinute) > (8 * 60 + 10);

      // Task 3: Lateness Negotiator (Show modal if late and no reason given)
      if (isLate && !isClockedIn && !finalReason) {
        setIsNegotiatingLate(true);
        setStep('idle'); // Pause to show reason selection
        return;
      }

      // Finalize Clock In/Out
      if (!isClockedIn) {
        const result = attendance.clockIn(user.id, user.name, userLocation, activeMethod, photo, detectedMood || 'neutral', finalReason);
        if (result.success) {
          toast(result.offline ? '📡 Saved offline.' : '✅ Verification Successful!', 'success');
        } else {
          toast(result.error || 'Failed', 'error');
        }
      } else {
        const result = attendance.clockOut(user.id, userLocation, activeMethod, photo);
        if (result.success) {
          toast(result.offline ? '📡 Saved offline.' : '✅ Clocked out!', 'success');
        }
      }
      setIsNegotiatingLate(false);
      setLatenessReason("");
    } catch (error: any) {
      toast(error.message || 'Verification Failed.', 'error');
      setStep('idle');
    } finally {
      if (!isNegotiatingLate) setStep('idle');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Task 3: Lateness Negotiator Modal */}
      {isNegotiatingLate && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <Card className="bg-[#1e1e35] border-[#2a2a4a] w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-xl font-bold">You are Late</h3>
              </div>
              <p className="text-[#888]">Please select a reason for your late arrival today:</p>
              <div className="grid grid-cols-1 gap-2">
                {['Traffic (Lagos Road)', 'Rain / Bad Weather', 'Vehicle Breakdown', 'Personal / Family', 'Health Issue'].map(r => (
                  <Button 
                    key={r} 
                    variant="outline" 
                    className="justify-start border-[#2a2a4a] hover:bg-[#6C63FF] hover:text-white"
                    onClick={() => {
                      setLatenessReason(r);
                      processBiometricClockAction(r);
                    }}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-gradient-to-br from-[#1e1e35] to-[#16162a] border-[#2a2a4a] overflow-hidden relative">
        <CardContent className="p-6">
          
          {step === 'processing' && (
            <div className="absolute inset-0 bg-[#0f0f1a]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#6C63FF] animate-spin mb-4" />
              <p className="text-[#e0e0f0] font-bold">Verifying Biometrics...</p>
            </div>
          )}

          {step === 'scanning-qr' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Scan Office QR</h3>
                <Button size="icon" variant="ghost" onClick={() => { stopQRScan(); setStep('idle'); }}>
                  <X className="w-5 h-5 text-white" />
                </Button>
              </div>
              <div id="qr-reader" className="w-full rounded-2xl overflow-hidden bg-black aspect-square" />
            </div>
          ) : step === 'capturing-face' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Identity Verification</h3>
                  <p className="text-xs text-[#888]">Hold steady for AI matching</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setStep('idle')}>
                  <X className="w-5 h-5 text-white" />
                </Button>
              </div>
              <div className={cn(
                "relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-w-sm mx-auto border-4 transition-all duration-300",
                faceDetected ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]" : "border-[#6C63FF]/30"
              )}>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover scale-x-[-1]"
                  videoConstraints={{ facingMode: "user" }}
                />
                
                <div className="absolute inset-0 border-[40px] border-black/40 mix-blend-multiply pointer-events-none" />
                <div className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed rounded-full transition-colors duration-300",
                  faceDetected ? "border-emerald-500 scale-105" : "border-[#6C63FF]"
                )} />

                {/* Task 2: Voice Challenge UI Overlay */}
                {faceDetected && voiceChallengeCode && (
                  <div className="absolute top-10 left-0 right-0 text-center animate-in fade-in zoom-in duration-500 px-4">
                    <div className="bg-black/60 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold">Liveness Verification</p>
                      </div>
                      <p className="text-4xl font-black text-white tracking-widest mb-2 font-mono">
                        {voiceChallengeCode}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <Mic className="w-3 h-3 text-emerald-400 animate-bounce" />
                        <p className="text-[10px] text-emerald-400 font-bold uppercase">Say numbers clearly</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mood/Status Indicator */}
                <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2">
                  {detectedMood && faceDetected && (
                    <Badge className="bg-[#6C63FF] text-white border-none animate-bounce">
                      Detected Mood: {detectedMood.toUpperCase()}
                    </Badge>
                  )}
                  <Badge className={cn(
                    "px-4 py-2 text-sm font-bold shadow-lg",
                    faceDetected ? "bg-emerald-500 text-white" : "bg-black/60 text-white border border-[#6C63FF]/50"
                  )}>
                    {faceDetected ? "Verifying..." : "Position face in oval"}
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={() => processBiometricClockAction()} 
                className={cn("w-full h-14 text-lg font-bold transition-all", faceDetected ? "bg-emerald-500" : "bg-[#6C63FF]")}
                disabled={!faceDetected}
              >
                {faceDetected ? "Capture Now" : "Waiting for Face..."}
              </Button>
            </div>
          ) : (
            <>
              {/* Default Idle State */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg", isClockedIn ? "from-emerald-500 to-emerald-400" : "from-amber-500 to-amber-400")}>
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-[#888]">Status</p>
                    <p className="text-xl font-bold text-[#e0e0f0]">{isClockedIn ? 'Clocked In' : 'Ready'}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-[#0f0f1a] rounded-xl mb-6 border border-[#2a2a4a]">
                <div className={cn("p-2 rounded-lg", gpsStatus === 'success' ? "bg-emerald-500/20" : "bg-amber-500/20")}>
                  <LocateFixed className={cn("w-5 h-5", gpsStatus === 'success' ? "text-emerald-400" : "text-amber-400")} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#e0e0f0]">{gpsStatus === 'success' ? 'Location Secured' : 'Acquiring GPS Lock...'}</p>
                  <p className="text-xs text-[#888]">{distance !== null ? `${distance}m from office` : 'Detecting...'}</p>
                </div>
                {gpsStatus !== 'success' && (
                  <Button size="sm" variant="ghost" onClick={handleGetLocation}><Navigation className="w-4 h-4 text-[#6C63FF]" /></Button>
                )}
              </div>

              {!modelsLoaded && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mb-4 justify-center">
                  <AlertTriangle className="w-3 h-3" /> AI Face Match loading...
                </p>
              )}

              {activeMethod === 'gps' ? (
                <Button 
                  className={cn("w-full h-16 text-lg font-bold rounded-xl shadow-xl transition-all", isClockedIn ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-[#6C63FF] hover:bg-[#5a52d5] shadow-[#6C63FF]/20")}
                  onClick={startGPSClock}
                  disabled={isClockedOut}
                >
                  <ShieldCheck className="w-6 h-6 mr-2" />
                  {isClockedIn ? 'Clock Out' : 'Secure Clock In'}
                </Button>
              ) : (
                <Button 
                  className="w-full h-16 text-lg font-bold rounded-xl bg-blue-500 hover:bg-blue-600 shadow-xl shadow-blue-500/20 transition-all"
                  onClick={startQRScan}
                  disabled={isClockedOut}
                >
                  <Scan className="w-6 h-6 mr-2" />
                  Scan QR to {isClockedIn ? 'Clock Out' : 'Clock In'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {step === 'idle' && (
        <Tabs value={activeMethod} onValueChange={(v) => setActiveMethod(v as any)}>
          <TabsList className="grid w-full grid-cols-2 bg-[#1e1e35] h-14 p-1 rounded-xl">
            <TabsTrigger value="gps" className="rounded-lg data-[state=active]:bg-[#6C63FF] data-[state=active]:text-white font-bold">
              <Navigation className="w-4 h-4 mr-2" /> GPS + Biometrics
            </TabsTrigger>
            <TabsTrigger value="qr" className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white font-bold">
              <QrCode className="w-4 h-4 mr-2" /> QR + Biometrics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}
