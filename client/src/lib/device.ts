const DEVICE_FINGERPRINT_KEY = 'dala-device-fingerprint';

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `dala-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return 'server-render';

  const existing = window.localStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (existing) return existing;

  const next = randomId();
  window.localStorage.setItem(DEVICE_FINGERPRINT_KEY, next);
  return next;
}

export function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Unknown device';

  const platform = navigator.platform || 'Unknown platform';
  const agent = navigator.userAgent || 'Unknown browser';

  if (/iPhone/i.test(agent)) return 'iPhone browser';
  if (/iPad/i.test(agent)) return 'iPad browser';
  if (/Android/i.test(agent)) return 'Android browser';
  if (/Windows/i.test(platform)) return 'Windows browser';
  if (/Mac/i.test(platform)) return 'Mac browser';

  return `${platform} browser`;
}

