// lib/rate-limit.ts
// DB-backed rate limiting for public API routes.
// Persists counters in Postgres so limits hold across serverless instances.
// Fails open on any DB error to avoid blocking legitimate traffic.

import { neon } from '@neondatabase/serverless';
import { NextRequest } from 'next/server';

const WINDOW_MINUTES = 15;

export function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function checkRateLimit(
  identifier: string,
  maxAttempts: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };

  try {
    const sql = neon(url);
    const rows = await sql`
      INSERT INTO rate_limits (identifier, attempts, window_start)
      VALUES (${identifier}, 1, NOW())
      ON CONFLICT (identifier) DO UPDATE
        SET attempts = CASE
              WHEN rate_limits.window_start < NOW() - INTERVAL '15 minutes' THEN 1
              ELSE rate_limits.attempts + 1
            END,
            window_start = CASE
              WHEN rate_limits.window_start < NOW() - INTERVAL '15 minutes' THEN NOW()
              ELSE rate_limits.window_start
            END
      RETURNING attempts, window_start
    `;

    const attempts = Number(rows[0]?.attempts ?? 1);
    const windowStart = new Date(rows[0]?.window_start ?? Date.now());
    const windowExpiresMs = windowStart.getTime() + WINDOW_MINUTES * 60 * 1000;
    const retryAfterSeconds = Math.max(0, Math.ceil((windowExpiresMs - Date.now()) / 1000));

    if (attempts > maxAttempts) {
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    return { allowed: true, remaining: Math.max(0, maxAttempts - attempts), retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }
}
