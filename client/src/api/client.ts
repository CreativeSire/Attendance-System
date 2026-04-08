const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/api';

let accessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

export const setToken = (token: string | null) => {
  accessToken = token;
};

export const getToken = () => accessToken;

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem('refreshToken');
      return null;
    }

    const { data } = await res.json();
    setToken(data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    return data.accessToken;
  } catch {
    localStorage.removeItem('refreshToken');
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        // Retry original request
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retry = await fetch(`${BASE_URL}${path}`, {
          method,
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!retry.ok) {
          const errData = await retry.json().catch(() => ({ message: 'Request failed' }));
          throw new Error(errData.message || 'Request failed');
        }

        return retry.json();
      } else {
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
    } else {
      // Wait for token refresh
      return new Promise((resolve, reject) => {
        refreshSubscribers.push(async (token: string) => {
          try {
            const retryHeaders = { ...headers, Authorization: `Bearer ${token}` };
            const retry = await fetch(`${BASE_URL}${path}`, {
              method,
              headers: retryHeaders,
              body: body ? JSON.stringify(body) : undefined,
            });
            const data = await retry.json();
            resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errData.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
