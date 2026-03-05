import { toast as sonnerToast } from 'sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
  description?: string;
}

export function useToast() {
  const toast = (message: string, type: ToastType = 'success', options?: ToastOptions) => {
    const config = {
      duration: options?.duration || 3000,
      description: options?.description,
    };

    switch (type) {
      case 'success':
        sonnerToast.success(message, config);
        break;
      case 'error':
        sonnerToast.error(message, config);
        break;
      case 'warning':
        sonnerToast.warning(message, config);
        break;
      case 'info':
        sonnerToast.info(message, config);
        break;
      default:
        sonnerToast(message, config);
    }
  };

  return { toast };
}

export { sonnerToast as toast };
