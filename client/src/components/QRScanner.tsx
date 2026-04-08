import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, Loader2, QrCode, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QRScannerProps { onScan: (token: string) => void; onError?: (err: string) => void; }

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const divId = 'qr-scanner-div';
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          scanner.clear();
        });
      }
    };
  }, [manualMode]);

  const startScanner = async () => {
    if (starting || started || manualMode) return;
    setCameraError(null);
    setStarting(true);

    try {
      const scanner = new Html5Qrcode(divId, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: { exact: 'environment' } },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        async (text) => {
          setStarted(false);
          await scanner.stop().catch(() => {});
          scanner.clear();
          scannerRef.current = null;
          onScan(text);
        },
        (err) => {
          if (onError && !err.includes('No MultiFormat')) onError(err);
        }
      );

      setStarted(true);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Camera access failed. Please allow camera permission and try again.';

      if (message.toLowerCase().includes('environment')) {
        try {
          const scanner = scannerRef.current ?? new Html5Qrcode(divId, { verbose: false });
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          async (text) => {
            setStarted(false);
            await scanner.stop().catch(() => {});
            scanner.clear();
            scannerRef.current = null;
            onScan(text);
          },
            (scanErr) => {
              if (onError && !scanErr.includes('No MultiFormat')) onError(scanErr);
            }
          );

          setStarted(true);
          setStarting(false);
          return;
        } catch (fallbackErr) {
          const fallbackMessage = fallbackErr instanceof Error
            ? fallbackErr.message
            : 'Camera access failed. Please allow camera permission and try again.';
          setCameraError(fallbackMessage);
          if (onError) onError(fallbackMessage);
        }
      } else {
        setCameraError(message);
        if (onError) onError(message);
      }
    } finally {
      setStarting(false);
    }
  };

  const resetScanner = async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      await scanner.stop().catch(() => {});
      scanner.clear();
      scannerRef.current = null;
    }
    setStarted(false);
    setCameraError(null);
  };

  if (manualMode) return (
    <div className="space-y-3">
      <p className="text-gray-400 text-sm text-center">Enter the QR token manually</p>
      <Input value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="Paste token here..." />
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
              On iPhone, the browser will ask for camera permission after you tap the button below.
            </p>
          </div>
          <Button onClick={startScanner} className="w-full gradient-accent text-white" isLoading={starting}>
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
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger text-left">
              {cameraError}
            </div>
          )}
        </div>
      )}

      <div
        id={divId}
        className={`${started ? 'block' : 'hidden'} min-h-[280px] [&_video]:rounded-xl [&_video]:w-full [&_video]:object-cover`}
      />

      <div className="flex flex-col items-center gap-2">
        {started && (
          <button
            onClick={resetScanner}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-accent transition-colors"
          >
            <RefreshCcw size={12} /> Restart camera
          </button>
        )}
        <button onClick={() => setManualMode(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent transition-colors mx-auto">
          <Keyboard size={12} /> Can't scan? Enter token manually
        </button>
      </div>
    </div>
  );
}
