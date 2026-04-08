import { Bell, Menu, Search } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/clock-in': 'Clock In / Out', '/bdd': 'Daily Pulse',
  '/attendance': 'Attendance', '/leaves': 'Leave Management', '/expenses': 'Expenses',
  '/payroll': 'Payroll', '/performance': 'Performance', '/team': 'Team',
  '/admin': 'Admin', '/profile': 'My Profile',
};

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const location = useLocation();
  const { notifications, unreadCount, markRead: markAsRead, markAllRead } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const title = pageTitles[location.pathname] || 'Dala';

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex lg:hidden items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface-2 text-gray-300 hover:text-white"
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>
        <h1 className="text-white font-semibold text-base md:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Search placeholder */}
        <div className="hidden md:flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-gray-500 text-sm w-48">
          <Search size={14} /> <span>Search...</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger rounded-full text-white text-xs flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-white font-medium text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-accent text-xs hover:underline">Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No notifications</div>
                ) : notifications.slice(0, 10).map(n => (
                  <button key={n.id} onClick={() => markAsRead(n.id)}
                    className={cn('w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors border-b border-border/50 last:border-0', !n.read && 'bg-accent/5')}>
                    <div className="flex items-start gap-2">
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', n.read ? 'text-gray-400' : 'text-white')}>{n.title}</p>
                        <p className="text-xs text-gray-500 truncate">{n.message}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
