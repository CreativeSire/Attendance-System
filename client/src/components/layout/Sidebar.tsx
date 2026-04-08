import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Clock, Calendar, ClipboardList, CalendarOff, Receipt, Banknote, TrendingUp, Users, Settings, LogOut, ChevronLeft, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin','manager','employee'] },
  { to: '/clock-in', icon: Clock, label: 'Clock In/Out', roles: ['admin','manager','employee'] },
  { to: '/bdd', icon: ClipboardList, label: 'Daily Pulse', roles: ['admin','manager','employee'] },
  { to: '/attendance', icon: Calendar, label: 'Attendance', roles: ['admin','manager','employee'] },
  { to: '/leaves', icon: CalendarOff, label: 'Leave', roles: ['admin','manager','employee'] },
  { to: '/expenses', icon: Receipt, label: 'Expenses', roles: ['admin','manager','employee'] },
  { to: '/payroll', icon: Banknote, label: 'Payroll', roles: ['admin','manager','employee'] },
  { to: '/performance', icon: TrendingUp, label: 'Performance', roles: ['admin','manager','employee'] },
  { to: '/team', icon: Users, label: 'Team', roles: ['admin','manager'] },
  { to: '/admin', icon: Settings, label: 'Admin', roles: ['admin'] },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = async () => {
    await logout();
    onCloseMobile?.();
    navigate('/login');
  };
  const filtered = navItems.filter(n => user && n.roles.includes(user.role));

  return (
    <>
      {!isDesktop && mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside className={cn(
        'flex flex-col h-screen bg-surface border-r border-border transition-all duration-300 shrink-0',
        isDesktop
          ? (collapsed ? 'w-16' : 'w-60')
          : 'fixed inset-y-0 left-0 z-40 w-72 max-w-[86vw] shadow-2xl',
        !isDesktop && (mobileOpen ? 'translate-x-0' : '-translate-x-full')
      )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-white font-bold text-lg">Dala</span>
          </div>
        )}
        {isDesktop ? (
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white transition-colors ml-auto">
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        ) : (
          <button onClick={onCloseMobile} className="text-gray-400 hover:text-white transition-colors ml-auto">
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filtered.map(item => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
            isActive
              ? 'bg-accent/20 text-accent border-l-2 border-accent'
              : 'text-gray-400 hover:text-white hover:bg-surface-2'
          )}
          onClick={() => {
            if (!isDesktop) onCloseMobile?.();
          }}>
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{user?.name?.charAt(0)}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs capitalize truncate">{user?.role}</p>
            </div>
          )}
          <button onClick={handleLogout} className="text-gray-500 hover:text-danger transition-colors shrink-0" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
