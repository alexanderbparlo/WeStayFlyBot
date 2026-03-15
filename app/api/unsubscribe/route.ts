// app/api/unsubscribe/route.ts
// GET /api/unsubscribe?token=<unsubscribe_token>
// Called from the one-click unsubscribe link in every email footer.
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { deactivateSubscriber } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const success = await deactivateSubscriber(token);
    if (!success) {
      return NextResponse.json({ error: 'Token not found or already unsubscribed' }, { status: 404 });
    }

    // Redirect to a simple confirmation page
    return NextResponse.redirect(new URL('/unsubscribed', req.url));
  } catch (err) {
    console.error('[unsubscribe] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
