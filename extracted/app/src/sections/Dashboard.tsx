import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAttendance } from '@/hooks/useAttendance';
import { useLocation } from '@/hooks/useLocation';
import { useQRCodeGenerator } from '@/hooks/useQRCode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Clock,
  MapPin,
  LogOut,
  TrendingUp,
  Briefcase,
  DollarSign,
  Settings,
  Menu,
  X,
  Home,
  Receipt,
  QrCode,
  Smile
} from 'lucide-react';
import { format } from 'date-fns';
import { ClockInOut } from './ClockInOut';
import { QRCodeManager } from './QRCodeManager';
import { AttendanceReports } from './AttendanceReports';
import { LeaveManagement } from './LeaveManagement';
import { PayrollExport } from './PayrollExport';
import { BulkAdminActions } from './BulkAdminActions';
import { LiveFeed } from './LiveFeed';
import { ExpenseManagement } from './ExpenseManagement';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { user, logout, hasRole } = useAuth();
  const attendance = useAttendance();
  const location = useLocation();
  const qrState = useQRCodeGenerator(user?.officeLocation || { lat: 6.5244, lng: 3.3792 }, 5);
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newBroadcast, setNewBroadcast] = useState("");

  useEffect(() => {
    qrState.startQRGenerator();
    return () => qrState.stopQRGenerator();
  }, []);

  const todayRecord = user ? attendance.getTodayRecord(user.id) : undefined;
  const isClockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;

  // Task 4: Geofenced Broadcasts
  const activeBroadcasts = attendance.broadcasts.filter(b => 
    new Date() < new Date(b.expiresAt)
  );

  const handleSendBroadcast = () => {
    if (!newBroadcast) return;
    attendance.addBroadcast(newBroadcast, user?.name || "Admin");
    setNewBroadcast("");
  };

  const todayRecords = attendance.getAllRecords(format(new Date(), 'yyyy-MM-dd'));

  const happyCount = todayRecords.filter((r: any) => r.mood === 'happy').length;
  const stressedCount = todayRecords.filter((r: any) => ['sad', 'angry', 'fearful'].includes(r.mood || '')).length;
  const neutralCount = todayRecords.length - happyCount - stressedCount;

  const navItems = [
    { id: 'overview', label: 'Home', icon: Home },
    { id: 'clock', label: 'Clock In', icon: Clock },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'leave', label: 'Leave', icon: Briefcase },
    ...(hasRole(['admin', 'manager']) ? [
      { id: 'live', label: 'Live Feed', icon: MapPin },
      { id: 'qr', label: 'QR Gate', icon: QrCode },
      { id: 'payroll', label: 'Payroll', icon: DollarSign },
      { id: 'admin', label: 'Admin', icon: Settings }
    ] : []),
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      {/* Task 4: User Broadcast Alert (Only if clocked in & in range) */}
      {isClockedIn && activeBroadcasts.length > 0 && (
        <div className="bg-[#6C63FF] text-white px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-500 overflow-hidden">
          <div className="flex items-center gap-3 overflow-hidden">
            <Badge className="bg-white/20 text-white border-none shrink-0">OFFICE ALERT</Badge>
            <div className="whitespace-nowrap animate-marquee">
              {activeBroadcasts.map(b => (
                <span key={b.id} className="mr-10 font-medium">
                  [{b.senderName}]: {b.message}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#16162a] border-b border-[#2a2a4a] sticky top-0 z-50 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6C63FF] flex items-center justify-center shadow-lg shadow-[#6C63FF]/20"><Clock className="w-5 h-5 text-white" /></div>
          <div><h1 className="font-bold text-[#e0e0f0] text-sm">DALA</h1><p className="text-[10px] text-[#888]">{format(new Date(), 'MMM d')}</p></div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-[#e0e0f0] lg:hidden">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-64 bg-[#16162a] border-r border-[#2a2a4a] min-h-screen p-4 sticky top-0">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all", activeTab === item.id ? "bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/20" : "text-[#888] hover:bg-[#2a2a4a]")}>
                <item.icon className="w-5 h-5" /> <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
          <Button variant="ghost" onClick={logout} className="w-full mt-8 text-red-400 hover:bg-red-500/10"><LogOut className="w-4 h-4 mr-2" /> Logout</Button>
        </aside>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-[#e0e0f0]">Welcome, {user.name} 👋</h2>
                
                {/* Task 1: Admin Mood Dashboard */}
                {hasRole(['admin', 'manager']) && todayRecords.length > 0 && (
                  <Card className="bg-[#1e1e35] border-[#2a2a4a] p-3 flex items-center gap-4">
                    <div className="text-xs text-[#888] font-bold uppercase tracking-wider">Company Morale</div>
                    <div className="flex h-3 w-48 rounded-full overflow-hidden bg-[#0f0f1a]">
                      <div style={{ width: `${(happyCount/todayRecords.length)*100}%` }} className="bg-emerald-500" title="Happy" />
                      <div style={{ width: `${(neutralCount/todayRecords.length)*100}%` }} className="bg-[#6C63FF]" title="Neutral" />
                      <div style={{ width: `${(stressedCount/todayRecords.length)*100}%` }} className="bg-red-500" title="Stressed" />
                    </div>
                    <div className="flex gap-2">
                      <Smile className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-white">{Math.round((happyCount/todayRecords.length)*100)}%</span>
                    </div>
                  </Card>
                )}
              </div>
              
              {/* Task 4: Admin Broadcast UI */}
              {hasRole(['admin', 'manager']) && (
                <Card className="bg-gradient-to-r from-[#1e1e35] to-[#16162a] border-[#6C63FF]/30 overflow-hidden">
                  <CardContent className="p-4 flex gap-3">
                    <Input 
                      placeholder="Send alert to clocked-in staff..." 
                      value={newBroadcast} 
                      onChange={e => setNewBroadcast(e.target.value)}
                      className="bg-[#0f0f1a] border-[#2a2a4a] text-white"
                    />
                    <Button onClick={handleSendBroadcast} className="bg-[#6C63FF]">Send</Button>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-[#1e1e35] border-[#2a2a4a] p-4">
                  <p className="text-xs text-[#888]">Shift Status</p>
                  <p className={cn("text-xl font-bold", isClockedIn ? "text-emerald-400" : "text-amber-400")}>
                    {isClockedIn ? 'Clocked In' : 'Off Duty'}
                  </p>
                </Card>
              </div>
              <Button onClick={() => setActiveTab('clock')} className="bg-[#6C63FF] h-14 w-full lg:w-48 text-lg font-bold shadow-xl shadow-[#6C63FF]/20">Clock In Now</Button>
            </div>
          )}

          {activeTab === 'clock' && <ClockInOut attendance={attendance} location={location} todayRecord={todayRecord} verifyQRCode={qrState.verifyQRCode} />}
          {activeTab === 'live' && hasRole(['admin', 'manager']) && <LiveFeed attendance={attendance} />}
          {activeTab === 'expenses' && <ExpenseManagement attendance={attendance} />}
          {activeTab === 'reports' && <AttendanceReports attendance={attendance} />}
          {activeTab === 'leave' && <LeaveManagement attendance={attendance} />}
          {activeTab === 'qr' && <QRCodeManager currentQR={qrState.currentQR} permanentCode={qrState.permanentCode} timeRemaining={qrState.timeRemaining} isValid={qrState.isValid} />}
          {activeTab === 'payroll' && <PayrollExport attendance={attendance} />}
          {activeTab === 'admin' && <BulkAdminActions attendance={attendance} />}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#16162a] border-t border-[#2a2a4a] z-50 h-16 flex justify-around items-center">
        {navItems.slice(0, 5).map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={cn("flex flex-col items-center gap-1", activeTab === item.id ? "text-[#6C63FF]" : "text-[#666]")}>
            <item.icon className="w-5 h-5" /> <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
