import 'dotenv/config';

const baseUrl = process.env.SMOKE_BASE_URL || 'https://dala-attendance.up.railway.app';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let data: unknown = text;

  try {
    data = JSON.parse(text);
  } catch {
    // Keep text body as-is for easier debugging.
  }

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function login(email: string, password: string) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }) as { data: { accessToken: string } };

  return result.data.accessToken;
}

async function authed(path: string, token: string, init?: RequestInit) {
  return request(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

async function main() {
  const checks: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: 'Health endpoint',
      run: async () => {
        await request('/health');
        await request('/health/ready');
      },
    },
    {
      name: 'Admin auth + dashboard',
      run: async () => {
        const token = await login('admin@dala.com', 'admin123');
        await authed('/api/admin/dashboard', token);
        await authed('/api/qr/entry-points', token);
      },
    },
    {
      name: 'Manager auth + live attendance',
      run: async () => {
        const token = await login('sarah@dala.com', 'password123');
        await authed('/api/attendance/live', token);
        await authed('/api/bdd/team', token);
      },
    },
    {
      name: 'Employee auth + self-service endpoints',
      run: async () => {
        const token = await login('amaka@dala.com', 'password123');
        await authed('/api/attendance/today-status', token);
        await authed('/api/attendance/my-stats', token);
        await authed('/api/bdd/today', token);
      },
    },
    {
      name: 'Public QR entry screen payload',
      run: async () => {
        await request('/api/qr/entry/ep-main');
      },
    },
  ];

  for (const check of checks) {
    await check.run();
    console.log(`PASS ${check.name}`);
  }

  console.log(`Smoke tests completed successfully against ${baseUrl}`);
}

main().catch((error) => {
  console.error('Smoke test failed');
  console.error(error);
  process.exit(1);
});
