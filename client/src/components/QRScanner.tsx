import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QRScannerProps { onScan: (token: string) => void; onError?: (err: string) => void; }

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const divId = 'qr-scanner-div';
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (manualMode) return;
    const scanner = new Html5QrcodeScanner(divId, { fps: 10, qrbox: 250, rememberLastUsedCamera: true }, false);
    scanner.render(
      (text) => { scanner.clear().catch(() => {}); onScan(text); },
      (err) => { if (onError && !err.includes('No MultiFormat')) onError(err); }
    );
    scannerRef.current = scanner;
    setStarted(true);
    return () => { scanner.clear().catch(() => {}); };
  }, [manualMode]);

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
      <div id={divId} className="[&_video]:rounded-xl [&_video]:w-full" />
      {started && (
        <button onClick={() => setManualMode(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent transition-colors mx-auto">
          <Keyboard size={12} /> Can't scan? Enter token manually
        </button>
      )}
    </div>
  );
}
