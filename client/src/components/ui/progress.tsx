import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number;
  color?: string;
}

export function Progress({ className, value = 0, color, ...props }: ProgressProps) {
  const bg = color || (value >= 80 ? '#2ecc71' : value >= 50 ? '#6C63FF' : value >= 30 ? '#e67e22' : '#e74c3c');
  return (
    <ProgressPrimitive.Root className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)} {...props}>
      <ProgressPrimitive.Indicator
        className="h-full transition-all duration-500 ease-out rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: bg }}
      />
    </ProgressPrimitive.Root>
  );
}
