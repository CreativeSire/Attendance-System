import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Printer,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import type { QRSession } from '@/types';

interface QRCodeManagerProps {
  currentQR: QRSession | null;
  permanentCode: string;
  timeRemaining: number;
  isValid: boolean;
}

export function QRCodeManager({ currentQR, permanentCode, timeRemaining, isValid }: QRCodeManagerProps) {
  const [view, setView] = useState<'dynamic' | 'static'>('dynamic');

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Dala Office QR Code</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-col; align-items: center; justify-content: center; height: 100vh; text-align: center; margin: 0; }
            .container { border: 10px solid #6C63FF; padding: 50px; border-radius: 40px; }
            h1 { font-size: 48px; color: #16162a; margin-bottom: 10px; }
            p { font-size: 24px; color: #666; margin-bottom: 40px; }
            .logo { font-weight: bold; color: #6C63FF; font-size: 32px; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>OFFICE CLOCK-IN</h1>
            <p>Scan to verify physical presence</p>
            <div id="qrcode"></div>
            <div class="logo">DALA ATTENDANCE</div>
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: "${permanentCode}",
              width: 400,
              height: 400
            });
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e0e0f0]">QR Gate</h2>
          <p className="text-sm text-[#888]">Entrance physical verification</p>
        </div>
        <div className="flex bg-[#1e1e35] p-1 rounded-lg">
          <Button 
            size="sm" 
            variant={view === 'dynamic' ? 'default' : 'ghost'} 
            onClick={() => setView('dynamic')}
            className={cn(view === 'dynamic' && "bg-[#6C63FF]")}
          >Tablet</Button>
          <Button 
            size="sm" 
            variant={view === 'static' ? 'default' : 'ghost'} 
            onClick={() => setView('static')}
            className={cn(view === 'static' && "bg-[#6C63FF]")}
          >Paper</Button>
        </div>
      </div>

      {view === 'dynamic' ? (
        <Card className="bg-[#1e1e35] border-[#2a2a4a]">
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className={cn(
                  "p-6 rounded-2xl bg-white transition-all",
                  isValid ? "shadow-lg shadow-emerald-500/20" : "opacity-50"
                )}>
                  {currentQR && (
                    <QRCodeSVG value={currentQR.code} size={200} level="H" />
                  )}
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                  <div className={cn(
                    "px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2",
                    timeRemaining < 30 ? "bg-red-500/20 text-red-400" : "bg-[#1e1e35] text-[#e0e0f0] border border-[#2a2a4a]"
                  )}>
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium tabular-nums">{formatTimeRemaining(timeRemaining)}</span>
                  </div>
                </div>
              </div>
              <Badge className={cn(isValid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                {isValid ? "Active Rotation" : "Expired"}
              </Badge>
              <p className="text-xs text-[#666] mt-4 text-center">Rotating code for high-security tablet display.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#1e1e35] border-[#2a2a4a]">
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              <div className="p-6 rounded-2xl bg-white mb-6">
                <QRCodeSVG value={permanentCode} size={200} level="H" />
              </div>
              <Button onClick={handlePrint} className="bg-[#6C63FF] w-full h-12 text-lg">
                <Printer className="w-5 h-5 mr-2" /> Print for Wall
              </Button>
              <p className="text-xs text-[#888] mt-4 text-center">
                This code is permanent. Security is maintained by<br/>
                <strong>GPS Geofencing</strong> and <strong>AI Face Match</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[#1e1e35] border-[#2a2a4a]">
          <CardContent className="p-4 text-center">
            <MapPin className="w-5 h-5 text-[#6C63FF] mx-auto mb-2" />
            <p className="text-xs text-[#888]">GPS Shield</p>
            <p className="text-sm text-emerald-400 font-bold">20m Active</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1e1e35] border-[#2a2a4a]">
          <CardContent className="p-4 text-center">
            <QrCode className="w-5 h-5 text-[#6C63FF] mx-auto mb-2" />
            <p className="text-xs text-[#888]">Biometrics</p>
            <p className="text-sm text-blue-400 font-bold">AI Active</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
