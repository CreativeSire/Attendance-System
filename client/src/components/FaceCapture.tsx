import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FaceCaptureProps {
  onCapture: (photo: string, faceDetected: boolean) => void;
  instruction?: string;
}

export default function FaceCapture({ onCapture, instruction = 'Position your face in the frame' }: FaceCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
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

  const retake = () => { setCaptured(null); setStatus('idle'); };

  if (cameraError) return (
    <div className="flex flex-col items-center gap-4 p-6 bg-surface-2 rounded-xl border border-border">
      <XCircle size={40} className="text-danger" />
      <p className="text-white font-medium">Camera not available</p>
      <p className="text-gray-400 text-sm text-center">Please allow camera access or use a device with a camera</p>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-gray-400 text-sm text-center">{instruction}</p>

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
          <Button onClick={capture} className="gradient-accent text-white px-6">
            <Camera size={16} className="mr-2" /> Capture
          </Button>
        ) : (
          <Button onClick={retake} variant="outline">
            <RotateCcw size={14} className="mr-2" /> Retake
          </Button>
        )}
      </div>
    </div>
  );
}
