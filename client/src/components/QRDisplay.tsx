import { useEffect, useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { qrApi } from '@/api/qr';
import { useSocket } from '@/hooks/useSocket';

interface QRDisplayProps { entryPointId: string; entryPointName: string; }

export default function QRDisplay({ entryPointId, entryPointName }: QRDisplayProps) {
  const [qrData, setQrData] = useState<{ qrDataUrl: string; expiresAt: string; token: string } | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchQR = async () => {
    try {
      setLoading(true);
      const res = await qrApi.getEntryToken(entryPointId) as { data: { qrDataUrl: string; expiresAt: string; token: string } };
      setQrData(res.data);
      const secs = Math.max(0, Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    } catch { /* retry */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchQR();
    if (socket) {
      socket.emit('qr:subscribe', { entryPointId });
      socket.on('qr:refresh', (data: { entryPointId: string; qrDataUrl: string; expiresAt: string; token: string }) => {
        if (data.entryPointId === entryPointId) {
          setQrData(data);
          setCountdown(180);
        }
      });
    }
    return () => { socket?.off('qr:refresh'); };
  }, [entryPointId, socket]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchQR(); return 180; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const urgency = countdown < 30;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-2xl shadow-2xl">
        {loading ? (
          <div className="w-64 h-64 flex items-center justify-center">
            <RefreshCw size={32} className="text-gray-400 animate-spin" />
          </div>
        ) : qrData ? (
          <img src={qrData.qrDataUrl} alt="Check-in QR" className="w-64 h-64" />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center text-gray-400">
            <p className="text-sm">Failed to load QR</p>
          </div>
        )}
      </div>

      <div className={`flex items-center gap-2 text-sm font-mono font-bold ${urgency ? 'text-danger' : 'text-gray-400'}`}>
        <RefreshCw size={12} className={urgency ? 'animate-spin' : ''} />
        Refreshes in {mins}:{String(secs).padStart(2, '0')}
      </div>
    </div>
  );
}
