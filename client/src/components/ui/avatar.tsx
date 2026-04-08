import { cn } from '@/lib/utils';

interface AvatarProps { src?: string | null; name?: string; size?: 'sm' | 'md' | 'lg'; className?: string; }

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className={cn('rounded-full gradient-accent flex items-center justify-center shrink-0 overflow-hidden', sizes[size], className)}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : <span className="text-white font-bold">{initials}</span>}
    </div>
  );
}
