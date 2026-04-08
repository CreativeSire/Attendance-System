import { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Keyboard, Loader2, QrCode, RefreshCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QRScannerProps {
  onScan: (token: string) => void;
  onError?: (err: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
    };
  }
}

const LAST_CAMERA_KEY = 'dala:last-working-camera-id';
const LAST_CAMERA_LABEL_KEY = 'dala:last-working-camera-label';

function pickPreferredCamera(cameras: CameraDevice[]) {
  if (cameras.length === 0) return null;

  const rememberedId = window.localStorage.getItem(LAST_CAMERA_KEY);
  const rememberedLabel = window.localStorage.getItem(LAST_CAMERA_LABEL_KEY)?.toLowerCase();

  if (rememberedId) {
    const exact = cameras.find((camera) => camera.id === rememberedId);
    if (exact) return exact;
  }

  if (rememberedLabel) {
    const remembered = cameras.find((camera) => camera.label.toLowerCase() === rememberedLabel);
    if (remembered) return remembered;
  }

  const preferred = cameras.find((camera) =>
    /(back|rear|environment|traseira|trasera|wide|ultra)/i.test(camera.label)
  );

  return preferred ?? cameras[cameras.length - 1];
}

function shouldIgnoreCameraError(error: string) {
  const normalized = error.toLowerCase();
  return (
    normalized.includes('no qr code found') ||
    normalized.includes('notfounderror') ||
    normalized.includes('no barcode or qr code detected') ||
    normalized.includes('parse error') ||
    normalized.includes('indexsizeerror') ||
    normalized.includes('decode')
  );
}

function getPermissionHelp(isIOS: boolean) {
  if (isIOS) {
    return [
      'Tap the site settings icon in Safari’s address bar.',
      'Set Camera to Allow.',
      'Reload the page and tap Open camera to scan QR again.',
    ];
  }

  return [
    'Click the camera icon in your browser address bar.',
    'Set camera permission for this site to Allow.',
    'Refresh the page and tap Open camera to scan QR again.',
  ];
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);
  const autoSwitchTimeoutRef = useRef<number | null>(null);
  const hasAutoSwitchedRef = useRef(false);

  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Point the camera at the QR code displayed at the door.');

  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const isIOS = useMemo(() => {
    const isIPhone = /iPhone/i.test(userAgent);
    const isIPad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && typeof window !== 'undefined' && 'ontouchend' in window);
    return isIPhone || isIPad;
  }, [userAgent]);

  const stopScanner = async () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (autoSwitchTimeoutRef.current) {
      window.clearTimeout(autoSwitchTimeoutRef.current);
      autoSwitchTimeoutRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    setStarted(false);
  };

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  const persistWorkingCamera = () => {
    const current = availableCameras.find((camera) => camera.id === activeCameraId);
    if (!current) return;
    window.localStorage.setItem(LAST_CAMERA_KEY, current.id);
    window.localStorage.setItem(LAST_CAMERA_LABEL_KEY, current.label);
  };

  const handleSuccessfulScan = async (token: string) => {
    persistWorkingCamera();
    await stopScanner();
    onScan(token);
  };

  const detectFromFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !started) return;

    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      animationRef.current = requestAnimationFrame(() => {
        void detectFromFrame();
      });
      return;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      animationRef.current = requestAnimationFrame(() => {
        void detectFromFrame();
      });
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      if (!detectorRef.current && window.BarcodeDetector) {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      }

      if (detectorRef.current) {
        const codes = await detectorRef.current.detect(canvas);
        const qr = codes.find((code) => typeof code.rawValue === 'string' && code.rawValue.trim().length > 0);
        if (qr?.rawValue) {
          await handleSuccessfulScan(qr.rawValue);
          return;
        }
      } else {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (result?.data) {
          await handleSuccessfulScan(result.data);
          return;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QR detection failed.';
      if (!shouldIgnoreCameraError(message) && onError) {
        onError(message);
      }
    }

    animationRef.current = requestAnimationFrame(() => {
      void detectFromFrame();
    });
  };

  const refreshDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({
        id: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 4)}`,
      }));
    setAvailableCameras(cameras);
    return cameras;
  };

  const startStream = async (cameraId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera scanning is not supported on this browser.');
    }

    const constraints: MediaStreamConstraints = {
      video: cameraId
        ? {
            deviceId: { exact: cameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();
    if (settings?.deviceId) {
      setActiveCameraId(settings.deviceId);
    } else {
      setActiveCameraId(cameraId ?? null);
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      throw new Error('Camera preview could not be initialized.');
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    await video.play();

    setStarted(true);
    setStatusMessage('Point the camera at the entrance QR code.');
    animationRef.current = requestAnimationFrame(() => {
      void detectFromFrame();
    });
  };

  const startScanner = async (forcedCameraId?: string) => {
    if (starting || manualMode) return;

    setStarting(true);
    setCameraError(null);
    hasAutoSwitchedRef.current = false;

    try {
      await stopScanner();
      const cameras = await refreshDevices();
      const preferred = forcedCameraId
        ? cameras.find((camera) => camera.id === forcedCameraId) ?? null
        : pickPreferredCamera(cameras);

      await startStream(preferred?.id);

      if (autoSwitchTimeoutRef.current) {
        window.clearTimeout(autoSwitchTimeoutRef.current);
      }

      autoSwitchTimeoutRef.current = window.setTimeout(() => {
        const video = videoRef.current;
        if (!video || hasAutoSwitchedRef.current || availableCameras.length < 2) return;

        const frameLooksUnavailable = video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0;
        if (frameLooksUnavailable) {
          hasAutoSwitchedRef.current = true;
          void switchCamera(true);
        }
      }, 2500);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Camera access failed. Please allow camera permission and try again.';

      setCameraError(message);
      setStatusMessage('Camera could not be opened yet.');
      if (onError && !shouldIgnoreCameraError(message)) {
        onError(message);
      }
      await stopScanner();
    } finally {
      setStarting(false);
    }
  };

  const resetScanner = async () => {
    setCameraError(null);
    setStatusMessage('Point the camera at the entrance QR code.');
    await stopScanner();
    await startScanner(activeCameraId ?? undefined);
  };

  const switchCamera = async (automatic = false) => {
    const cameras = availableCameras.length > 0 ? availableCameras : await refreshDevices();
    if (cameras.length < 2) return;

    const currentIndex = cameras.findIndex((camera) => camera.id === activeCameraId);
    const nextCamera = cameras[(currentIndex + 1 + cameras.length) % cameras.length];
    if (!nextCamera) return;

    if (!automatic) {
      setStatusMessage('Switching camera...');
    }

    await startScanner(nextCamera.id);
  };

  const permissionHelp = getPermissionHelp(isIOS);

  if (manualMode) {
    return (
      <div className="space-y-3">
        <p className="text-gray-400 text-sm text-center">Enter the QR token manually</p>
        <Input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste token here..." />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setManualMode(false)}>
            <QrCode size={14} className="mr-2" /> Use Camera
          </Button>
          <Button className="flex-1" onClick={() => manualToken && onScan(manualToken)} disabled={!manualToken}>
            Submit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!started && (
        <div className="rounded-xl border border-border bg-surface-2 p-5 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
            <Camera size={24} className="text-accent" />
          </div>
          <div className="space-y-1">
            <p className="text-white font-medium">Open your camera to scan the entrance QR</p>
            <p className="text-gray-400 text-sm">
              We’ll try the best rear camera first, and you can switch cameras if the preview isn’t right.
            </p>
          </div>
          <Button onClick={() => void startScanner()} className="w-full gradient-accent text-white" isLoading={starting}>
            {starting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Opening camera...
              </>
            ) : (
              <>
                <Camera size={16} className="mr-2" />
                Open camera to scan QR
              </>
            )}
          </Button>
          {cameraError && (
            <div className="space-y-3">
              <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger text-left">
                {cameraError}
              </div>
              <div className="rounded-lg border border-border bg-surface p-4 text-left space-y-2">
                <p className="text-white text-sm font-medium">How to allow camera access</p>
                <div className="text-sm text-gray-400 space-y-1">
                  {permissionHelp.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`${started ? 'block' : 'hidden'} space-y-3`}>
        <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-border bg-black">
          <video
            ref={videoRef}
            className="min-h-[320px] w-full object-cover"
            muted
            autoPlay
            playsInline
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-[2rem] border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(8,8,16,0.38)]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-8 text-center">
            <p className="text-sm text-white">{statusMessage}</p>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex flex-col items-center gap-2">
        {started && (
          <div className="flex items-center gap-4">
            {availableCameras.length > 1 && (
              <button
                onClick={() => void switchCamera()}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-accent transition-colors"
              >
                <RotateCw size={12} /> Switch camera
              </button>
            )}
            <button
              onClick={() => void resetScanner()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-accent transition-colors"
            >
              <RefreshCcw size={12} /> Restart camera
            </button>
          </div>
        )}
        <button
          onClick={() => {
            void stopScanner();
            setManualMode(true);
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent transition-colors mx-auto"
        >
          <Keyboard size={12} /> Can't scan? Enter token manually
        </button>
      </div>
    </div>
  );
}
