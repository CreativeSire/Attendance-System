import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Zap } from 'lucide-react';
import { qrApi } from '@/api/qr';
import type { EntryPoint } from '@/types';

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center space-y-2">
      <div className="text-8xl font-bold text-white font-mono tracking-wider tabular-nums">
        {format(time, 'HH:mm:ss')}
      </div>
      <div className="text-2xl text-gray-400">{format(time, 'EEEE, MMMM d, yyyy')}</div>
    </div>
  );
}

export default function EntryScreen() {
  const { entryPointId } = useParams<{ entryPointId: string }>();
  const [qrData, setQrData] = useState<{ qrDataUrl: string; expiresAt: string; token: string } | null>(null);
  const [entryPoint, setEntryPoint] = useState<EntryPoint | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [loading, setLoading] = useState(true);

  const fetchQR = async () => {
    if (!entryPointId) return;
    try {
      setLoading(true);
      const res = await qrApi.getEntryToken(entryPointId) as { data: { qrDataUrl: string; expiresAt: string; token: string } };
      setQrData(res.data);
      const secs = Math.max(0, Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch entry point details
    if (entryPointId) {
      qrApi.getEntryPoints()
        .then((res) => {
          const eps = (res as { data: EntryPoint[] }).data;
          const ep = eps.find((e) => e.id === entryPointId);
          if (ep) setEntryPoint(ep);
        })
        .catch(() => {});
    }

    fetchQR();

    // Request fullscreen
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});

    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [entryPointId]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { fetchQR(); return 180; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const urgency = countdown < 30;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-12 px-8 select-none relative overflow-hidden"
      style={{
        backgroundColor: '#0f0f1a',
        backgroundImage: 'linear-gradient(rgba(108,99,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.06) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Subtle glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center z-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">DALA HQ</span>
        </div>
        <h1 className="text-5xl font-bold text-white mt-2">{entryPoint?.name ?? (entryPointId ? `Entry Point ${entryPointId.slice(0, 8)}` : 'Main Entrance')}</h1>
        {entryPoint?.location && (
          <p className="text-gray-500 text-lg mt-2">{entryPoint.location}</p>
        )}
      </div>

      {/* QR Code center */}
      <div className="flex flex-col items-center gap-8 z-10">
        <div className="bg-white p-6 rounded-3xl shadow-2xl shadow-accent/20">
          {loading ? (
            <div className="w-80 h-80 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : qrData ? (
            <img src={qrData.qrDataUrl} alt="Check-in QR Code" className="w-80 h-80" />
          ) : (
            <div className="w-80 h-80 flex items-center justify-center text-gray-400">
              <p>Failed to load QR</p>
            </div>
          )}
        </div>

        <div className="text-center space-y-3">
          <p className="text-4xl font-semibold text-gray-300">Scan to Clock In</p>
          <div className={`inline-flex items-center gap-2 text-sm font-mono font-bold px-4 py-2 rounded-full border ${urgency ? 'text-danger border-danger/30 bg-danger/10' : 'text-gray-500 border-border bg-surface'}`}>
            <span className={`w-2 h-2 rounded-full ${urgency ? 'bg-danger animate-pulse' : 'bg-gray-500'}`} />
            Refreshes in {mins}:{String(secs).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Bottom: Live clock + branding */}
      <div className="text-center z-10 space-y-6">
        <LiveClock />
        <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
          <Zap size={12} className="text-accent" />
          Powered by Dala Workforce Intelligence
        </div>
      </div>
    </div>
  );
}
