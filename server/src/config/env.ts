import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function buildDatabaseUrlFromParts(rawEnv: NodeJS.ProcessEnv): string | undefined {
  const host = rawEnv.PGHOST;
  const port = rawEnv.PGPORT || '5432';
  const database = rawEnv.PGDATABASE;
  const user = rawEnv.PGUSER;
  const password = rawEnv.PGPASSWORD;

  if (!host || !database || !user || !password) return undefined;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function getRailwayClientUrl(rawEnv: NodeJS.ProcessEnv): string | undefined {
  if (rawEnv.CLIENT_URL) return rawEnv.CLIENT_URL;
  if (rawEnv.RAILWAY_STATIC_URL) return `https://${rawEnv.RAILWAY_STATIC_URL}`;
  if (rawEnv.RAILWAY_PUBLIC_DOMAIN) return `https://${rawEnv.RAILWAY_PUBLIC_DOMAIN}`;
  return undefined;
}

function resolveRequiredSecret(key: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string | undefined {
  const value = process.env[key];
  if (value && value.trim().length > 0) return value;

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    return `${key.toLowerCase()}-local-development-only`;
  }

  return undefined;
}

const normalizedEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || buildDatabaseUrlFromParts(process.env),
  DATABASE_PUBLIC_URL: process.env.DATABASE_PUBLIC_URL || buildDatabaseUrlFromParts(process.env),
  JWT_SECRET: resolveRequiredSecret('JWT_SECRET'),
  JWT_REFRESH_SECRET: resolveRequiredSecret('JWT_REFRESH_SECRET'),
  PORT: process.env.PORT || '3001',
  CLIENT_URL: getRailwayClientUrl(process.env) || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_PUBLIC_URL: z.string().optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  PORT: z.string().default('3001'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.string().default('development'),
});

const parsedEnv = envSchema.safeParse(normalizedEnv);

if (!parsedEnv.success) {
  console.error('Environment validation failed:', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
