import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  PORT: z.string().default('3001'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.string().default('development'),
});

export const env = envSchema.parse(process.env);
