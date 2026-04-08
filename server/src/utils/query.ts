import { Request } from 'express';

/** Safely extract a string query param — never returns string[] */
export function qs(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (Array.isArray(v)) return v[0] as string;
  if (typeof v === 'string') return v;
  return undefined;
}
