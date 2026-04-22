// app/api/unsubscribe/route.ts
// GET /api/unsubscribe?token=<unsubscribe_token>
// Called from the one-click unsubscribe link in every email footer.
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { deactivateSubscriber } from '@/lib/db';
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Rate limiting: 10 unsubscribe attempts per IP per 15 min
  const ip = getRequestIp(req);
  const rl = await checkRateLimit(`${ip}:unsubscribe`, 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      }
    );
  }

  const token = req.nextUrl.searchParams.get('token');

  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 });
  }

  try {
    const success = await deactivateSubscriber(token);
    if (!success) {
      return NextResponse.json({ error: 'Token not found or already unsubscribed' }, { status: 404 });
    }

    return NextResponse.redirect(new URL('/unsubscribed', req.url));
  } catch (err) {
    console.error('[unsubscribe] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
