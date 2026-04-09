import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, ImagePlus, Info, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FaceCaptureProps {
  onCapture: (photo: string, faceDetected: boolean) => void;
  instruction?: string;
}

export default function FaceCapture({ onCapture, instruction = 'Position your face in the frame' }: FaceCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'captured' | 'error'>('idle');
  const [cameraError, setCameraError] = useState(false);

  const capture = useCallback(() => {
    const photo = webcamRef.current?.getScreenshot();
    if (!photo) { setStatus('error'); return; }
    setCaptured(photo);
    setStatus('captured');
    onCapture(photo, true);
  }, [onCapture]);

  const loadFromFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = typeof reader.result === 'string' ? reader.result : null;
      if (!image) {
        setStatus('error');
        return;
      }
      setCaptured(image);
      setStatus('captured');
      setCameraError(false);
      onCapture(image, true);
    };
    reader.onerror = () => setStatus('error');
    reader.readAsDataURL(file);
  }, [onCapture]);

  const retake = () => {
    setCaptured(null);
    setStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (cameraError) return (
    <div className="flex flex-col items-center gap-4 p-6 bg-surface-2 rounded-xl border border-border">
      <XCircle size={40} className="text-danger" />
      <p className="text-white font-medium">Camera not available</p>
      <p className="text-gray-400 text-sm text-center">Please allow camera access or use your device’s native photo/camera picker below.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => loadFromFile(event.target.files?.[0] ?? null)}
      />
      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
        <ImagePlus size={14} className="mr-2" />
        Use image or phone camera
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-gray-400 text-sm text-center">{instruction}</p>
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-gray-400">
        <Info size={13} className="text-accent" />
        If live camera is unreliable, use your device’s image picker to take or upload a face photo.
      </div>

      <div className="relative rounded-xl overflow-hidden border-2 border-border w-64 h-64">
        {!captured ? (
          <>
            <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" className="w-full h-full object-cover"
              onUserMediaError={() => setCameraError(true)}
              videoConstraints={{ width: 256, height: 256, facingMode: 'user' }} />
            {/* Face oval guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-48 border-2 border-accent/60 rounded-full" />
            </div>
          </>
        ) : (
          <img src={captured} alt="Captured" className="w-full h-full object-cover" />
        )}

        {status === 'captured' && (
          <div className="absolute bottom-2 right-2">
            <CheckCircle size={24} className="text-success" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {status !== 'captured' ? (
          <>
            <Button onClick={capture} className="gradient-accent text-white px-6">
              <Camera size={16} className="mr-2" /> Capture
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(event) => loadFromFile(event.target.files?.[0] ?? null)}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={14} className="mr-2" /> Use image
            </Button>
          </>
        ) : (
          <div className="flex gap-3">
            <Button onClick={retake} variant="outline">
              <RotateCcw size={14} className="mr-2" /> Retake
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={14} className="mr-2" /> Replace image
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
