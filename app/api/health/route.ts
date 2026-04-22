// app/api/health/route.ts
// GET /api/health
// Diagnostic endpoint: checks DB connectivity and schema migration status.
// Reports only boolean flags and table names — no secrets exposed.
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const REQUIRED_TABLES = [
  'subscribers',
  'origin_airports',
  'destinations',
  'deals_sent',
  'price_baseline_cache',
];

export async function GET(): Promise<NextResponse> {
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    dbUrlPresent: !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL),
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    SERPAPI_API_KEY: !!process.env.SERPAPI_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '(not set — using built-in default)',
  };

  let database: Record<string, unknown> = { ok: false };

  try {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) {
      database = {
        ok: false,
        error: 'No database URL env var found.',
        hint: 'Set DATABASE_URL or POSTGRES_URL in Vercel → Settings → Environment Variables.',
      };
    } else {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(url);
      const rows = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(${REQUIRED_TABLES})
        ORDER BY table_name
      `;
      const found = rows.map((r) => r.table_name as string);
      const missing = REQUIRED_TABLES.filter((t) => !found.includes(t));
      database = {
        ok: missing.length === 0,
        tablesFound: found,
        tablesMissing: missing,
        hint:
          missing.length > 0
            ? 'Run lib/schema.sql in your Vercel Postgres console to create missing tables.'
            : 'Schema OK.',
      };
    }
  } catch (err) {
    database = {
      ok: false,
      error: String(err),
      hint: 'Verify DATABASE_URL / POSTGRES_URL is correct and the database is reachable.',
    };
  }

  const healthy = env.dbUrlPresent && !!(database.ok);
  return NextResponse.json({ healthy, env, database }, { status: healthy ? 200 : 503 });
}
